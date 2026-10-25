---
title: "Safe 多簽：Sorted Signatures 與 Circular Linked List"
description: 從 Safe 合約錢包的驗簽與 owner 管理，看排序與環狀鏈結串列在合約中的應用
---

這篇用 [Safe](https://safe.global/) 合約錢包當例子，介紹兩個 DSA 的應用：

1. **Sorted Signatures**：驗簽時用排序檢查 signer 有沒有重複
2. **Circular Linked List (CLL)**：用 mapping 實作 owner list

**先備知識**

- 寫過智能合約
- 知道合約可以當作錢包使用
- 知道 ECDSA 中 sign 和 recover 在做什麼（不需要懂數學）

## 背景：合約錢包的多簽

用單一私鑰控制錢包，等於整個錢包只有一個單點故障：私鑰可能失竊、遺失，或被誤按簽章。多簽 (multisig) 把錢包的控制權分給多個 owner，簽名數達到門檻 (threshold) 才能執行操作。依錢包設計，這個權限可以涵蓋更換 owner、發送交易、移動資產等。

實現多簽的方式有兩大類：

- **EOA 錢包**：用 MPC 把私鑰拆給多方保管，最簡單的做法是 Shamir Secret Sharing (SSS)，可參考 Web3Auth。
- **合約錢包**：利用合約的可編程性，把 owner 從單一 `address` 變成一組 address。對呼叫時帶入的 signature 做 recover，就能知道簽名者是不是 owner。合法簽名數 ≥ threshold 時，交易就能送出。

每個 owner 對同一個提案（程式上是一段 calldata，對鏈來說就是以這個錢包發起一筆交易）簽章，代表他授權這個提案。提案可以是更換 owner，也可以是把錢包裡的資產轉給別人。累積簽名的過程就像投票。

基本的多簽錢包實作可參考：

- [Solidity by Example — Multi-Sig Wallet](https://solidity-by-example.org/app/multi-sig-wallet/)
- [iT 邦幫忙 — 多簽錢包](https://ithelp.ithome.com.tw/articles/10287335)

### 鏈上累積簽名 vs. 鏈下收集簽名

如果完全去中心化授權，每筆簽名都要寫進 storage：每個 signer 各發一筆交易去驗證並記錄自己的簽名，等累積到門檻再由某人觸發執行。每個 signer 都要付一次 gas fee（至少包含每筆交易的 21000 基本 gas，細節見[黃皮書](https://ethereum.github.io/yellowpaper/paper.pdf)），而且最後沒通過的提案，簽過的人也白付了手續費。

所以多數多簽錢包商會提供中心化服務：owner 在前端對提案簽章，簽名先存在錢包商的資料庫，累積到門檻後**一次把所有簽名送上鏈驗證**，只需要付一次 gas fee。

> 這種做法要信任前端與資料庫的正確性，也有隱私上的考量（例如 IP 被記錄），這裡不展開。

以下討論都建立在這個前提：**驗簽時，合約一次拿到整批簽名 (`signatures`)**。

## Sorted Signatures：檢查重複 signer

一次驗證整批簽名時，至少要確認以下五件事：

1. 每個 signer 都是對同一個提案（calldata 或它的 hash）簽章
2. 簽章本身合法
3. signer 是 owner
4. **沒有重複的 signer**
5. 合法簽名數達到門檻

第 4 點有幾種做法，複雜度差很多。

### 方法一：Nested Mapping

```solidity
// mapping from tx index => owner => bool
mapping(uint256 => mapping(address => bool)) public isConfirmed;
```

讀寫都是 O(1)，但 mapping 只能是 state variable，寫 storage 的 gas 遠高於 memory。而且這筆資料在驗簽後就再也用不到，也沒辦法釋放並拿回當初付的 gas，空間使用很沒效率。

### 方法二：Memory Array

把紀錄移到 function scope 的 memory：

```solidity
function checkSignatures() external {
    // ...
    address[] memory approvedOwners = new address[](ownersNum);
    // ...
}
```

寫入是 O(1)，但每驗一個簽名都要遍歷 `approvedOwners` 檢查是否重複，單次 O(n)，整體 O(n²)。

### 方法三：Sorted Signatures（Safe 的做法）

**要求呼叫者把簽名依 signer 地址由小到大排序後再送進來。** 驗簽時只要檢查每個 recover 出來的 signer 都嚴格大於前一個，就能保證沒有重複。

`address` 本質上是 20 bytes 的數值（等同 `uint160`），在 Solidity 中可以直接比大小：

```solidity
address a = 0x1111111111111111111111111111111111111111;
address b = 0x2222222222222222222222222222222222222222;
require(a < b); // 成立
```

**例子**：共有 5 個 owner（`owner_0` ~ `owner_4`），threshold 是 3。`owner_1`、`owner_3`、`owner_4` 同意，鏈下收集到 `signature_1`、`signature_3`、`signature_4`，依 owner 地址排序後送上鏈。合約依序 recover 出 `owner_1 → owner_3 → owner_4`，每一個都比前一個大，驗證通過。如果有人重複塞同一個 signer 的簽名，兩個相同地址就無法滿足「嚴格遞增」，交易會 revert。

以下是簡化過的 Safe `checkNSignatures`：

```solidity
function checkNSignatures(
    address executor,
    bytes32 dataHash,
    bytes memory signatures,
    uint256 requiredSignatures
) public view {
    // Check that the provided signature data is not too short
    if (signatures.length < requiredSignatures.mul(65)) revertWithError("GS020");
    // There cannot be an owner with address 0.
    address lastOwner = address(0);
    address currentOwner;
    // ...

    for (i = 0; i < requiredSignatures; ++i) {
        // recover currentOwner from the i-th signature
        // ...
        if (currentOwner <= lastOwner || owners[currentOwner] == address(0) || currentOwner == SENTINEL_OWNERS)
            revertWithError("GS026");
        lastOwner = currentOwner;
    }
}
```

這個 `if` 一次檢查三件事：

- `currentOwner <= lastOwner`：沒有嚴格遞增，代表重複或沒排序
- `owners[currentOwner] == address(0)`：不是 owner（見下方 CLL）
- `currentOwner == SENTINEL_OWNERS`：不能是哨兵值

時間複雜度是 O(n)，額外空間只需要 `lastOwner` 一個變數，也不用寫 storage。

### 比較

| 方法 | 檢查重複的時間複雜度 | 額外空間 | 位置 |
| --- | --- | --- | --- |
| Nested Mapping | O(n) | O(n) | storage（貴，且無法釋放） |
| Memory Array | O(n²) | O(n) | memory |
| Sorted Signatures | O(n) | O(1) | memory |

### 實作細節：排序要在哪裡做

驗簽前必須先排好序。如果簽名是在鏈下收集的，在 SDK 排序最省 gas：

```typescript
public sortSignatures(signatures: Hex[], signers: Address[]): Hex[] {
  if (signatures.length !== signers.length) {
    throw Error("The length of signatures and signers are different")
  }
  const addressesInBigint: bigint[] = signers.map((signer) => {
    return fromHex(signer, "bigint")
  })
  return signatures
    .map((signature, index) => ({
      signature,
      address: addressesInBigint[index]
    }))
    .sort((a, b) => {
      if (a.address < b.address) return -1
      else if (a.address > b.address) return 1
      else {
        throw Error("Duplicated signer")
      }
    })
    .map((item) => item.signature)
}
```

如果簽名是在合約內組出來的（例如另一個合約代為收集），就要在 Solidity 裡排序。下面是一個 quick sort，以 signer 地址 (`arr`) 為 key，同步交換 `signatures`：

```solidity
function _quickSort(
    bytes[] memory signatures,
    uint[] memory arr,
    int left,
    int right
) internal {
    int i = left;
    int j = right;
    if (i == j) return;
    uint pivot = arr[uint(left + (right - left) / 2)];
    while (i <= j) {
        while (arr[uint(i)] < pivot) i++;
        while (pivot < arr[uint(j)]) j--;
        if (i <= j) {
            (arr[uint(i)], arr[uint(j)]) = (arr[uint(j)], arr[uint(i)]);
            (signatures[uint(i)], signatures[uint(j)]) = (
                signatures[uint(j)],
                signatures[uint(i)]
            );
            i++;
            j--;
        }
    }
    if (left < j) _quickSort(signatures, arr, left, j);
    if (i < right) _quickSort(signatures, arr, i, right);
}
```

## Circular Linked List：管理 Owner List

> 不熟悉 CLL 可以先看 [GeeksforGeeks — Circular Linked List](https://www.geeksforgeeks.org/circular-linked-list/)。

上面的驗簽程式碼裡有兩個看起來奇怪的地方：`owners[currentOwner]` 的取值方式，以及 `SENTINEL_OWNERS`。

直覺的做法是 `address[] owners` 搭配 `mapping(address => bool) isOwner`。Safe 則只用一個 mapping，讓每個 owner 指向下一個 owner：

```solidity
address internal constant SENTINEL_OWNERS = address(0x1);

mapping(address => address) internal owners;
```

結構如下：

```
SENTINEL_OWNERS → owner_A → owner_B → owner_C → SENTINEL_OWNERS
```

- `owners[SENTINEL_OWNERS]` 是第一個 owner
- 最後一個 owner 指回 `SENTINEL_OWNERS`，形成一個環
- 不是 owner 的地址，`owners[addr]` 會是 `address(0)`，所以 `owners[addr] != address(0)` 就是 isOwner 檢查

### 哨兵 (Sentinel) 的作用

`SENTINEL_OWNERS` 作為固定的頭節點，讓串列裡不會出現 null（`address(0)`）指標，也省掉邊界條件的處理。例如刪除最後一個 owner 時，只要把前一個節點指向 `SENTINEL_OWNERS`，不用額外判斷「下一個是不是 null」。

### 複雜度比較

| 操作 | `address[]` + `isOwner` mapping | CLL (`mapping(address => address)`) |
| --- | --- | --- |
| isOwner 查詢 | O(1) | O(1) |
| 新增 owner | O(1) | O(1)（插在 sentinel 後面） |
| 刪除 owner | O(n)：要找位置並搬移元素（或 swap-and-pop） | O(1)：呼叫者在鏈下先找出 `prevOwner` 當參數傳入 |
| 遍歷所有 owner | O(n) | O(n)：從 sentinel 一路走回 sentinel |
| 初始化 n 個 owner（含重複檢查） | O(n) 搭配 mapping；只用 array 檢查重複則是 O(n²) | O(n)：`owners[owner] != address(0)` 就是重複 |

CLL 用一個 mapping 同時做到 O(1) 的 isOwner 查詢、O(1) 的增刪，以及遍歷整個 owner list。刪除 owner 的 O(1) 前提是呼叫者在鏈下先找出 `prevOwner`，合約只需要驗證 `owners[prevOwner] == owner`。

## 總結

Safe 同時使用兩種技巧，各自解決不同的問題：

- **Sorted Signatures**：驗簽時檢查 signer 不重複。要求 signer 地址嚴格遞增，用 O(n) 時間、O(1) 額外空間完成，不寫 storage。
- **CLL**：管理 owner list。用一個 mapping 同時支援 O(1) 的 isOwner 查詢、O(1) 的增刪，並能遍歷所有 owner。驗簽時的 `owners[currentOwner] != address(0)` 就是靠它做 isOwner 檢查。

## 延伸：多簽錢包的 signer 可以是誰？

本篇假設 signer 都是 EOA，但實際上 signer 也可能是：

- EOA
- 合約 (CA)，例如透過 EIP-1271 驗簽
- AA 錢包

有興趣可以去看 Safe 的原始碼，看它怎麼依不同的 signer 類型驗簽。
