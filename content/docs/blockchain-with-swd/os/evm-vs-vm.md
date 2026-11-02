---
title: "EVM vs VM：從作業系統與狀態機看區塊鏈 VM"
description: 傳統虛擬機、EVM、以及區塊鏈作為複製狀態機 (replicated state machine) 的對照
---

這篇從作業系統 (OS) 的角度，對照「一般的 virtual machine」和「區塊鏈的 virtual machine」(EVM、WASM、MoveVM…)，重點在於：

- VM 本質上是什麼？
- **狀態機 (state machine)** 這個抽象是怎麼接起 OS 跟區塊鏈？
- 為什麼 EVM 要砍掉這麼多功能才叫 EVM？

## 一、VM 的兩種意思

在 OS 的世界，"VM" 其實有兩個完全不同的東西：

### 1. System VM (系統虛擬機)

把整台硬體虛擬化：CPU、記憶體、磁碟、網卡都是模擬出來的，上面可以跑完整的 OS kernel。

- 例子：**VMware、VirtualBox、QEMU、KVM、Hyper-V**。
- 跑的是 **ring 0 的 kernel code**，底下靠 hypervisor 攔截特權指令。
- 一台物理機上可以同時跑 Linux + Windows + macOS。

### 2. Process VM (程序虛擬機)

替**單一個應用程式**提供一個抽象的執行環境，隔離它跟底層 OS、CPU 架構。

- 例子：**JVM、.NET CLR、V8 (JavaScript engine)、Python interpreter、Dalvik/ART**。
- 跑的是 **bytecode 或 IR**，而不是真實的 x86/ARM 指令。
- 好處：
  - **可攜性**：write once, run anywhere。
  - **沙箱 (sandbox)**：bytecode 不能亂摸 OS 的 syscall，必須透過 VM 給的 API。
  - **GC、JIT**：VM 可以在執行期做記憶體管理和最佳化。

**EVM、WASM、MoveVM、SVM (Solana) 全部屬於 process VM 這一類**，只是「沙箱」被鎖得特別緊。

## 二、OS 跟區塊鏈都是狀態機

**狀態機 (state machine)** 是看懂這件事的關鍵抽象。

```
state_{n+1} = f(state_n, input_n)
```

一個系統只要有「當前狀態」、「輸入」、「狀態轉移函式」，就是一台狀態機。

### OS 看成狀態機

| 元件 | 對應到狀態機的什麼 |
| --- | --- |
| 磁碟上的 inode、檔案內容 | 持久狀態 (persistent state) |
| RAM 裡的 process table、page table | 揮發狀態 (volatile state) |
| syscall、中斷、I/O 事件 | 輸入 (input) |
| kernel scheduler + syscall handler | 狀態轉移函式 $f$ |

從這個角度看，OS 其實就是一台狀態機：使用者按鍵、網路封包、計時器中斷進來，kernel 更新 process 表、檔案系統、記憶體映射。

### 區塊鏈看成狀態機

| 元件 | 對應 |
| --- | --- |
| World state (accounts, storage, code) | 持久狀態 |
| Transaction | 輸入 |
| EVM 執行 + state transition function | 狀態轉移函式 $f$ |
| 共識 | 讓多台機器對「下一個 input 是什麼」達成共識 |

Ethereum Yellow Paper 直接把 Ethereum 描述成 **"a transaction-based state machine"**，狀態轉移函式常寫成：

$$
\sigma_{t+1} = \Upsilon(\sigma_t, T)
$$

其中 $\sigma_t$ 是 world state，$T$ 是 transaction，$\Upsilon$ 是 state transition function。這跟上面 OS 的式子是同一個模板。

### 區塊鏈 = **複製狀態機 (replicated state machine)**

區塊鏈真正特別的地方：**同一台狀態機在 N 台機器上同時跑，而且每一台都要得到相同的 $\sigma_{t+1}$**。這叫 **Replicated State Machine (RSM)**，是分散式系統的經典抽象。要讓這件事成立，需要三個條件：

1. **相同的初始狀態** $\sigma_0$：genesis block。
2. **相同的輸入序列**：共識機制決定 transaction order（PoW 的最長鏈、PoS 的 BFT 提案…）。
3. **$f$ 必須是確定性的 (deterministic)**：同樣的輸入、同樣的狀態，所有節點算出來的新狀態要一模一樣。

第三點就是為什麼 EVM 要砍掉那麼多「正常 VM 覺得天經地義」的功能。

## 三、EVM 跟傳統 process VM 的對照

拿 **JVM** 當基準比一下：

| 面向 | JVM / 一般 process VM | EVM |
| --- | --- | --- |
| 指令形式 | Stack-based bytecode | Stack-based bytecode |
| 字長 | 32-bit int, 64-bit long, float, double | **只有 256-bit word**（配合 keccak、secp256k1） |
| 記憶體 | Heap + GC + stack | **揮發 memory + 永久 storage**，沒有 GC |
| I/O | file、socket、stdout、clock、random | **完全沒有**：不能讀檔、沒有時鐘、沒有亂數 |
| 執行緒 | 有 | 沒有，單執行緒順序執行 |
| 浮點數 | IEEE 754 | **沒有**（跨硬體不確定性） |
| 系統呼叫 | 走 Java API → JNI → libc syscall | 只有少數 opcode：`CALL`, `SSTORE`, `LOG`, `CREATE`… |
| 資源控制 | OS 的 cgroup、JVM 的 heap 上限 | **Gas**：每個 opcode 消耗固定 gas，超過就 revert |
| 退出條件 | 程式自己決定 | gas 耗盡 / `STOP` / `REVERT` / `INVALID` |
| 來源 | `.class` 檔，載入自檔案系統 | 從 contract storage 讀 bytecode（部署時固化） |

重點不是 EVM 功能少，而是**那些功能都會引入非確定性**：

- 讀檔、網路、時鐘 → 不同節點看到不同結果。
- 浮點數 → 不同 CPU 的 rounding mode 可能不同。
- 多執行緒 → scheduling 無法重現。
- GC 時機 → 可以用來做 side-channel。

EVM 的設計哲學是：**要麼完全確定，要麼不要**。所以它主動放棄了這些功能，用 **gas** 這個單純、本地可計算的量來限制資源使用。

## 四、EVM 作為「區塊鏈的 kernel」

繼續用 OS 類比：

| OS 的概念 | EVM / 區塊鏈的對應 |
| --- | --- |
| Kernel | **EVM** (或 state transition function 本體) |
| User process | **Smart contract** |
| Process ID | **Contract address** |
| 虛擬記憶體 | **Storage trie**（每個合約有自己的 slot 空間） |
| Syscall | **Opcode**（`SLOAD`, `SSTORE`, `CALL`, `LOG`, `CREATE`, `SELFDESTRUCT`） |
| IPC (process 間溝通) | **`CALL` / `DELEGATECALL` / `STATICCALL`** |
| fork() | **`CREATE` / `CREATE2`** |
| 使用者 ID | **msg.sender / tx.origin** |
| 檔案 | **Storage slot** |
| CPU 時間片 | **Gas limit** |
| OOM killer | **Out of gas → revert** |
| 權限模型 | **沒有 ring，由合約自己檢查** |

幾個值得注意的差別：

- **沒有 preemptive scheduling**：一個 transaction 就是一條直線跑到底，沒有 context switch。
- **沒有 kernel/user ring**：合約沒有特權等級，所有合約平等。EVM 本身是 kernel，所有「使用者程式」都在 EVM 之上。
- **全域可讀**：OS 裡 process A 不能隨便讀 process B 的記憶體；EVM 裡任何人都能從外部讀取任何合約的 storage（但只有合約自己能寫入）。
- **執行就要付錢**：OS 的 scheduler 分配 CPU 時間是「隱性」的，EVM 用 gas 把 CPU + memory + storage 的成本全部顯化到 user 身上。

## 五、幾種區塊鏈 VM 的對照

區塊鏈 VM 不只有 EVM。用「state machine + 哪種 bytecode」兩個軸看：

| VM | Bytecode | 字長 | 併發 | 代表鏈 |
| --- | --- | --- | --- | --- |
| **EVM** | 自訂 stack-based | 256-bit | 單執行緒 | Ethereum, L2s |
| **SVM (Solana)** | eBPF (RISC-ish, register-based) | 64-bit | **交易層平行化**（Sealevel） | Solana |
| **MoveVM** | 自訂 (resource-oriented) | 64-bit + resource type | 可平行 | Aptos, Sui |
| **WASM VM** | WebAssembly | 32/64-bit | 單執行緒 | NEAR, CosmWasm, Polkadot |
| **CairoVM** | Cairo bytecode | field element | 單執行緒 | Starknet |
| **zkVM (RISC-V)** | RISC-V | 32-bit | 單執行緒 | 不是 L1，是 proving 層（見 [RISC 跟 ZK 的關係](./risc-and-zk.md)） |

共通點：**都是 process VM、都是 deterministic、都用某種 metering (gas / weight / steps) 控資源**。差別在於 bytecode 選得多貼近通用 CPU、資料模型是 account-based 還是 resource-based、交易層能不能平行化。

## 六、把三層接起來：OS、EVM、zkVM

這系列的三個 VM 其實是**層層巢狀**的：

```
┌───────────────────────────────────────────────┐
│  OS (Linux kernel)                            │
│   ├─ Process VM: Geth / Reth (Go / Rust)      │
│   │     └─ EVM：執行合約 bytecode             │  ← 共識層確定性
│   │           └─ Smart contract               │
│   └─ Process VM: zkVM prover (RISC Zero / SP1)│
│         └─ RISC-V guest 程式                  │  ← 把上面整段執行寫成電路
│               └─ (可以是另一個 EVM!)          │     再做 ZK proof
└───────────────────────────────────────────────┘
```

- 最外層是普通 OS，上面跑著 Geth / Reth 這類節點軟體。
- 節點軟體裡嵌入 EVM，作為「對共識友善的狀態機」。
- 現代 ZK rollup 的 prover 有時會把整個 EVM interpreter 丟進 **zkVM** 裡跑，再對這段執行生成 ZK proof（見 [RISC 跟 ZK 的關係](./risc-and-zk.md)）。

**三層都是狀態機**，差別只在：

- OS 這台狀態機要跟硬體打交道 (非確定)。
- EVM 這台狀態機要跟共識打交道 (必確定)。
- zkVM 這台狀態機要跟 proof system 打交道 (必確定 + 可被電路表達)。

## 重點整理

- **VM 有兩種**：system VM (虛擬整台機器) 和 process VM (替單一程式提供執行環境)。區塊鏈的 EVM / WASM / MoveVM 都是 process VM。
- **OS、EVM、zkVM 都能用狀態機抽象描述**：$state_{n+1} = f(state_n, input_n)$。
- **區塊鏈 = 複製狀態機 (RSM)**：N 台機器對同一台狀態機達成共識。要達成共識就必須**確定性**。
- **EVM 比 JVM 功能少**，不是技術落後，而是刻意砍掉所有會引入非確定性的功能（I/O、時鐘、亂數、浮點、多執行緒）。
- **Gas** 是把 OS 的 CPU/記憶體/儲存成本顯化給使用者買單的機制，取代了 OS 的 scheduler + OOM killer。
- EVM 像是「區塊鏈的 kernel」，合約是「user process」，storage 是「檔案」，`CALL` 是「syscall / IPC」。

## 延伸閱讀

- [Ethereum Yellow Paper](https://ethereum.github.io/yellowpaper/paper.pdf) — EVM 與 state transition function 的形式化定義
- [EVM Deep Dives (noxx)](https://noxx.substack.com/p/evm-deep-dives-the-path-to-shadowy)
- [Solana Sealevel: Parallel Processing Thousands of Smart Contracts](https://medium.com/solana-labs/sealevel-parallel-processing-thousands-of-smart-contracts-d814b378192)
- [Move: A Language With Programmable Resources](https://developers.diem.com/papers/diem-move-a-language-with-programmable-resources/2020-05-26.pdf)
- [Lamport — Time, Clocks, and the Ordering of Events](https://lamport.azurewebsites.net/pubs/time-clocks.pdf) — RSM 的起點
