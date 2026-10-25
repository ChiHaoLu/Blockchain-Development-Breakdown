---
title: "在本地起一條 Infra Testnet 做整合測試"
description: 用 Docker Compose 起 Geth dev 鏈、部署合約、接上 Bundler，並在 GitHub Actions 中跑同一套流程
---

這篇以我之前做的 AA (Account Abstraction) SDK 為例，整理「在本地起一條真正的鏈 + 周邊 infra，再對它跑整合測試」的完整流程，包含：

- 為什麼不直接用 Anvil / Hardhat Network
- 用 Docker Compose 編排 Geth、合約部署、Bundler
- Geth dev mode 的參數與互動方式
- 測試程式怎麼連上這條鏈
- 在 GitHub Actions 跑同一套流程 (CI)

## 為什麼不用 Anvil 或 Hardhat Network

Foundry 的 `anvil` 和 Hardhat Network 都是**開發用的 EVM 模擬器**：啟動快、可以 `evm_snapshot` / `evm_revert`、可以 fork 主網、可以 `anvil_setBalance` 隨意改狀態。寫合約的單元測試時，它們是最好的選擇。

但 SDK 要測的不是單一合約，而是**一整條鏈上的互動流程**：

```
SDK ──UserOperation──▶ Bundler ──eth_sendRawTransaction──▶ 節點 ──▶ EntryPoint ──▶ 錢包合約
         ▲                │
         └── 查詢 receipt ─┘ debug_traceCall 做模擬驗證
```

這時候「真的節點客戶端」有幾個好處：

| 面向 | Anvil / Hardhat | Geth dev mode |
| --- | --- | --- |
| 本質 | 用 Rust/JS 重寫的 EVM 模擬器 | 跟主網節點同一套客戶端，只是單機出塊 |
| RPC 行為 | 大致相容，但細節（錯誤格式、gas 估算、tracer）可能不同 | 跟主網節點一致 |
| `debug_traceCall` 與 tracer | 支援程度有限 | 完整支援 JS / native tracer |
| 周邊 infra | 部分 infra 不一定能接 | Bundler、Indexer、Explorer 等可以直接接上 |
| 改狀態的作弊碼 | 有（`anvil_*`、`hardhat_*`、`evm_*`） | 沒有，只能真的發交易 |

最關鍵的是 Bundler。ERC-4337 Bundler 在收到 UserOperation 時，要用 `debug_traceCall` 搭配 tracer 模擬執行，檢查是否違反 ERC-7562 的驗證規則（禁止的 opcode、storage 存取限制等）。這部分 Bundler 通常是對著 Geth 開發與測試的，接 Geth 最不容易踩到相容性問題。

另外，沒有作弊碼反而是好事：測試只能用「真實使用者會走的路徑」來改變狀態，比較接近上線後的行為。

> 取捨：真正的鏈比較慢、不能 snapshot/revert，測試之間的狀態會互相累積。下面會提到怎麼處理。

## 整體架構

整套 testnet 由四個 container 組成，用 Docker Compose 編排：

| Service | Image | 角色 | 生命週期 |
| --- | --- | --- | --- |
| `geth` | `ethereum/client-go:v1.14.7` | 單節點 dev 鏈，對外開 `8545` | 常駐 |
| `geth_setup` | `ghcr.io/foundry-rs/foundry:stable` | 等鏈起來後，clone 合約 repo，用 `forge` / `cast` 部署合約 | 跑完就結束 |
| `rundler` | Rundler（Rust 寫的 ERC-4337 Bundler） | 對外開 `3000` 的 Bundler RPC | 常駐 |
| `rundler_setup` | `alpine:3` | 等 Bundler 起來後，切成手動打包模式 | 跑完就結束 |

```
            ┌─────────────── Docker network ───────────────┐
            │                                              │
            │  geth_setup ──(forge / cast)──▶ geth:8545    │
            │                                    ▲         │
            │                       (NODE_HTTP)  │         │
            │  rundler_setup ──(curl)──▶ rundler:3000      │
            │                                              │
            └───────────────┬──────────────────┬───────────┘
                            │                  │
                     localhost:8545     localhost:3000
                            ▲                  ▲
                            └──── Jest 測試 ────┘
```

常駐服務 (`geth`、`rundler`) 加上一次性的 setup job (`*_setup`) 是這套設計的核心：**鏈與 infra 由 image 提供，初始狀態由 setup job 用真實交易建立**。

## Step 1：Geth dev mode

```yaml
services:
  geth:
    image: ethereum/client-go:v1.14.7
    ports:
      - "8545:8545"
    command:
      - --dev
      - --networkid=1337
      - --datadir=/root/.ethereum
      - --keystore=/root/.ethereum/keystore
      - --unlock=0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266
      - --password=/root/.ethereum/keystore/password
      - --allow-insecure-unlock
      - --rpc.allow-unprotected-txs
      - --miner.gaslimit=12000000
      - --http
      - --http.addr=0.0.0.0
      - --http.vhosts=*
      - --http.api=personal,eth,net,web3,debug,clique
      - --nodiscover
      - --maxpeers=0
      - --verbosity=2
    volumes:
      - ./keystore:/root/.ethereum/keystore
```

逐項說明：

**鏈本身**

- `--dev`：開發者模式。單節點、自動出塊，啟動時會產生 genesis 並預先給 dev 帳戶大量 ETH。從 Geth 1.13 開始，dev mode 用模擬的 beacon client 出塊，不再是早期的 Clique PoA。預設在有交易時才出塊，可以用 `--dev.period` 改成固定間隔出塊。
- `--networkid=1337`：dev mode 的 chain ID 是 `1337`，SDK 端的 chain 設定也要用同一個值。
- `--miner.gaslimit`：每個區塊的 gas 上限。

**帳戶**

- `--keystore` + `--unlock` + `--password`：把一組 keystore 掛進 container 並解鎖，Geth 就會把這個帳戶當成 dev 帳戶（預先撥款的那個）。
- 這裡用的是 `0xf39F...2266`，也就是 Anvil / Hardhat 預設的第 0 個帳戶（助記詞 `test test ... junk`）。好處是私鑰大家都知道，測試程式直接寫死即可，不用另外傳遞。**這組私鑰是公開的，絕對不能用在任何有真錢的鏈上。**
- `--allow-insecure-unlock`：預設 Geth 不允許在開了 HTTP RPC 的情況下解鎖帳戶，dev 環境要明確打開。
- `--rpc.allow-unprotected-txs`：允許沒有 EIP-155 replay protection 的交易。有些工具（例如部署 deterministic deployment proxy 的 pre-EIP-155 交易）需要這個。

**RPC**

- `--http --http.addr=0.0.0.0`：在 container 內對所有介面開 HTTP RPC，才能被其他 container 和 host 存取。
- `--http.vhosts=*`：接受任何 Host header。從其他 container 用 `http://geth:8545` 連線時，Host 是 `geth`，不開會被拒絕。
- `--http.api=...`：開放的 namespace。`debug` 是給 Bundler 做 `debug_traceCall` 用的，一定要開。

**網路**

- `--nodiscover --maxpeers=0`：不找其他節點，確保這是一條完全隔離的鏈。

> 這份設定是從舊版 Geth 一路沿用下來的，裡面有幾個在 1.14 dev mode 下已經沒有作用的參數，例如 `--mine`、`--miner.etherbase`，以及 setup 腳本中呼叫的 `clique_propose`（dev mode 不再使用 Clique）。它們不影響運作，但升級 Geth 時可以順便清掉。

### 怎麼跟 Geth 互動

鏈起來之後，就是一個標準的 JSON-RPC endpoint，任何工具都能用：

```bash
# 查詢最新區塊
cast block-number --rpc-url http://localhost:8545

# 查詢餘額
cast balance 0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266 --rpc-url http://localhost:8545

# 直接打 JSON-RPC
curl -s -X POST http://localhost:8545 \
  -H "Content-Type: application/json" \
  -d '{"jsonrpc":"2.0","id":1,"method":"eth_chainId","params":[]}'

# 進入 Geth 的 JS console
docker compose -f ./docker/testnet/docker-compose.yml exec geth geth attach /root/.ethereum/geth.ipc
```

## Step 2：用 setup container 部署合約

`geth_setup` 用 Foundry 的官方 image，只負責一件事：把測試需要的合約部署到鏈上，然後結束。

```yaml
  geth_setup:
    image: ghcr.io/foundry-rs/foundry:stable
    platform: linux/amd64
    depends_on:
      - geth
    command: /geth_setup/entry.sh
    environment:
      - PAT=${PAT}
    volumes:
      - ./geth_setup:/geth_setup
      - ./script:/script
    user: root
```

`entry.sh` 的流程：

```bash
#!/bin/sh
apk update && apk --no-cache add bash curl coreutils

rpc_url="http://geth:8545"

# 1. 等 geth 的 port 打得通
/script/wait.sh geth:8545 -t 60 || { echo "wait for ${rpc_url} failed"; exit 1; }

# 2. 用 PAT clone 私有的合約 repo，並固定在某個 commit
git clone --filter=blob:none --no-checkout https://${PAT}@github.com/<org>/<contracts-repo>.git
cd <contracts-repo>
git checkout <commit-hash>
forge install

# 3. 從 dev 帳戶撥款給 deployer
cast send --rpc-url ${rpc_url} --private-key ${operator_private_key} ${deployer_address} --value 100ether

# 4. 用 deployer 依序部署合約
forge create --rpc-url ${rpc_url} --private-key ${deployer_private_key} \
  lib/account-abstraction/contracts/core/EntryPoint.sol:EntryPoint \
  --broadcast --optimize true --optimizer-runs 200

forge create --rpc-url ${rpc_url} --private-key ${deployer_private_key} \
  src/account/factory/AccountEntryFactory.sol:AccountEntryFactory \
  --broadcast --constructor-args ${operator_address}
# ... 其他 validator、factory、handler

# 5. 部署後的初始化設定
cast send --rpc-url ${rpc_url} --private-key ${operator_private_key} \
  ${entry_factory_address} "setImpl(address implAddr)" ${account_entry_impl_address}
```

幾個設計重點：

### `depends_on` 不等於「已經準備好」

`depends_on` 只保證**啟動順序**，不保證 Geth 已經可以接受 RPC。所以 setup 腳本一開始要用 [`wait-for-it.sh`](https://github.com/vishnubob/wait-for-it)（這裡的 `wait.sh`）去輪詢 `geth:8545`，打得通才繼續，60 秒內沒起來就失敗退出。

### 用 `CREATE` 讓合約地址固定

合約地址由 `keccak256(rlp(deployer, nonce))` 決定。只要每次都是**全新的鏈 + 同一個 deployer + 同樣的部署順序**，每個合約的地址就永遠一樣。所以：

- setup 腳本和測試程式可以直接把合約地址寫死，不需要「部署完把地址寫進檔案再給測試讀」這種傳遞機制。
- 代價是部署順序不能隨便改，中間多插一筆 deployer 的交易，後面所有地址都會位移。
- 刻意把 **deployer** 和 **operator（dev 帳戶）** 分開：operator 會用來撥款、做設定，nonce 不固定；deployer 只用來部署，nonce 才可預測。

> 另一個選擇是用 `CREATE2` + deterministic deployment proxy，地址只跟 salt 和 bytecode 有關，不受 nonce 影響，比較不怕順序被打亂。

### 合約版本要 pin 住

合約 repo 是 checkout 到固定 commit，不是追 `main`。SDK 的測試是對著某一版合約寫的，合約 repo 更新不應該讓 SDK 的 CI 突然壞掉。要升級合約時，改這個 commit hash 和對應的地址，當成一個明確的變更。

### 私有 repo 的存取

合約 repo 是私有的，所以用 GitHub Personal Access Token (`PAT`) clone：

- 本地：寫在 `.env`，由 `docker compose --env-file .env` 帶入 container 的環境變數。
- CI：存在 GitHub Actions secrets，執行時寫進 `.env`。

## Step 3：Bundler

```yaml
  rundler:
    image: <rundler-image>
    command: node
    ports:
      - "3000:3000"   # RPC
      - "8080:8080"   # Metrics
    depends_on:
      - geth
      - geth_setup
    environment:
      - CHAIN_ID=1337
      - NODE_HTTP=http://geth:8545
      - ENTRY_POINT_V0_6_ENABLED=false
      - CHAIN_ENTRY_POINT_ADDRESS_V0_7=0x8464135c8F25Da09e49BC8782676a84730C318bC
      - BUILDER_PRIVATE_KEY=0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80
      - BUILDER_MAX_BUNDLE_SIZE=1
      - MIN_STAKE_VALUE=0
      - MIN_UNSTAKE_DELAY=0
      - RPC_API=eth,debug,rundler
      - RPC_TIMEOUT_SECONDS=600
      - RUST_LOG=debug
```

- `NODE_HTTP=http://geth:8545`：在 Compose network 裡用 service name 當 hostname。
- `CHAIN_ENTRY_POINT_ADDRESS_V0_7`：就是 setup 腳本用 `CREATE` 部署出來的固定地址，這也是地址必須固定的原因之一。
- `BUILDER_PRIVATE_KEY`：Bundler 送 bundle 交易時用的 EOA，同樣用 dev 帳戶，確保有 ETH 付 gas。
- `MIN_STAKE_VALUE=0`、`MIN_UNSTAKE_DELAY=0`：放寬 paymaster / factory 的 stake 要求，測試時不用先去 stake。
- `BUILDER_MAX_BUNDLE_SIZE=1`：每個 bundle 只放一個 UserOperation，讓每筆 UserOp 的結果獨立、好除錯。
- `RPC_API=eth,debug,rundler`：開 `debug` namespace，下面的手動模式會用到。

### 手動打包模式

`rundler_setup` 等 Bundler 起來之後，把它切成手動模式：

```bash
/script/wait.sh rundler:3000 -t 60 || exit 1

curl -X POST http://rundler:3000 \
  -H "Content-Type: application/json" \
  -d '{"jsonrpc":"2.0","id":1,"method":"debug_bundler_setBundlingMode","params":["manual"]}'
```

預設 Bundler 會定時從 mempool 取出 UserOp 打包。手動模式下，只有收到 `debug_bundler_sendBundleNow` 時才打包。SDK 的 `BundlerProvider` 有一個 `Manual` 模式，送出 UserOp 後會自己呼叫：

```typescript
if (this.mode === BundlerMode.Manual) {
  await this.debugSendBundleNow()
}

private async debugSendBundleNow() {
  await this.bundler.send({ method: "debug_bundler_sendBundleNow" })
}
```

好處是測試是**確定性的**：送出 → 立刻打包 → 立刻上鏈，不用等 Bundler 的打包週期，也不會有多筆 UserOp 被湊在同一個 bundle 的情況。

`debug_bundler_*` 是 ERC-4337 bundler spec test 定義的除錯 RPC，正式環境的 Bundler 不會開放。

## Step 4：測試怎麼連上這條鏈

測試的設定集中在一個 helper：

```typescript
export const config = {
  rpc_url: "http://localhost:8545",
  bundler_url: "http://localhost:3000",
  entryPointAddress: "0x8464135c8F25Da09e49BC8782676a84730C318bC",
  // rich wallet in local devnet
  ownerPrivateKey: "0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80",
  accountFactoryAddress: "0x712516e61C8B383dF4A63CFe83d7701Bce54B03e",
  // ... 其他用 CREATE 部署出來的固定地址
}

export const testRole = {
  bundler: new BundlerProvider({
    url: config.bundler_url,
    mode: BundlerMode.Manual
  }),
  provider: getPublicClient(config.rpc_url),
  wallet: getWalletClient(config.rpc_url, privateKeyToAccount(config.ownerPrivateKey)),
}
```

SDK 用 viem，對 localhost 定義一條自訂 chain：

```typescript
chain = defineChain({
  id: 1337,
  name: "Localhost",
  nativeCurrency: { decimals: 18, name: "Ether", symbol: "ETH" },
  rpcUrls: {
    default: { http: ["http://localhost:8545"] }
  }
})
```

### 處理測試間的狀態累積

真正的鏈沒有 `evm_revert`，所有測試都在同一條鏈上累積狀態。避免互相干擾的做法是**讓每個測試自己產生獨立的狀態**，而不是去重置鏈：

```typescript
export function getRandomWallet(): PrivateKeyAccount {
  return privateKeyToAccount(generatePrivateKey())
}

export function getRandomSalt(): bigint {
  return hexToBigInt(getRandomBytes())
}
```

每個測試用隨機 salt 建立新的錢包合約 (counterfactual address 也會不同)、用隨機產生的 owner，就不會跟其他測試撞到。

另外 Jest 用 `jest -i`（`--runInBand`）**循序執行**。所有測試共用同一個 dev 帳戶發交易，平行跑會造成 nonce 衝突。

## Step 5：本地開發流程

用 `Makefile` 包一層：

```makefile
testnet-up:
	docker compose -f ./docker/testnet/docker-compose.yml --env-file .env up --build

testnet-down:
	docker compose -f ./docker/testnet/docker-compose.yml --env-file .env down -v --remove-orphans
```

```bash
# Terminal 1：起鏈（前景執行，可以直接看 log）
make testnet-up

# Terminal 2：等 setup 跑完後跑測試
yarn test

# 結束後清掉
make testnet-down
```

- `testnet-up` 在前景執行，Geth、合約部署、Rundler 的 log 都會直接印出來，部署失敗時一眼就能看到。
- `testnet-down` 的 `-v` 會一起刪掉 volume，下次起來就是全新的鏈。這很重要，因為合約地址依賴「全新的鏈 + deployer nonce 從 0 開始」。
- `--remove-orphans` 清掉 compose 檔裡已經不存在的舊 container。

## Step 6：CI/CD（GitHub Actions）

CI 跑的是同一套 testnet，但拆成兩個 compose 檔：

| 檔案 | 內容 | 執行方式 |
| --- | --- | --- |
| `docker-compose-node.yml` | `geth`、`rundler`，並建立名為 `testnet` 的 network | `up -d`，背景常駐 |
| `docker-compose-node-setup.yml` | `geth_setup`、`rundler_setup`，以 `external: true` 加入 `testnet` network | `up`，前景跑完才進下一步 |

```yaml
name: Test with Docker Devnet

on:
  push:
    branches: [main]
  pull_request:
    branches: [main]

jobs:
  test:
    runs-on: ubuntu-22.04
    steps:
      - uses: actions/checkout@v3

      - uses: docker/setup-buildx-action@v2

      - uses: actions/setup-node@v3
        with:
          node-version: "20"

      - run: yarn install
      - run: yarn build

      - name: Create .env file
        run: echo "PAT=${{ secrets.PAT }}" > .env

      - name: Spin up testnet
        run: docker compose -p testnet -f ./docker/testnet/docker-compose-node.yml --env-file .env up --build -d

      - name: Set up testnet
        run: docker compose -p testnet-setup -f ./docker/testnet/docker-compose-node-setup.yml --env-file .env up --build

      - name: Run tests
        run: yarn test:ci
```

### 為什麼要拆成兩個 compose 檔

本地用單一 compose 檔前景執行沒問題，人看到部署完成再開另一個 terminal 跑測試就好。但 CI 是一步一步執行的，需要明確知道「**部署什麼時候結束**」：

1. 常駐服務用 `up -d` 在背景啟動，這一步會立刻返回。
2. setup job 用 `up`（不加 `-d`）在前景執行，**等所有 setup container 結束才返回**，所以下一步跑測試時合約一定已經部署好。
3. 兩個 compose 用 `-p` 指定不同的 project name，透過共用一個具名 network (`name: testnet` / `external: true`) 互通，setup container 才能用 `geth:8545`、`rundler:3000` 找到服務。

### `CI_TEST`：跳過不穩定的測試

```json
"test:ci": "CI_TEST=true yarn test"
```

GitHub Actions 的 runner 資源有限，有些需要很多筆 UserOp 的長流程測試容易超時（例如 Bundler 的模擬驗證超時）。用環境變數讓這些測試在 CI 裡跳過：

```typescript
export function conditionalTest(description: string, fn: jest.ProvidesCallback) {
  if (process.env.CI_TEST === "true") {
    test.skip(description, fn)
  } else {
    test(description, fn)
  }
}
```

這是一種取捨：CI 保證核心流程一定會跑，比較重的測試則要求在本地跑過。被跳過的測試要有清單，避免永遠沒人跑。

### Secrets

- `PAT` 存在 repo 的 Actions secrets，只在執行時寫進 `.env`。
- dev 帳戶私鑰是公開的測試私鑰，寫死在程式碼裡沒有問題；但真正的 secret（PAT、RPC API key、paymaster token）一律走 secrets，`.env` 加進 `.gitignore`，repo 只放 `.env.example`。

## 可以再改進的地方

| 問題 | 改進方式 |
| --- | --- |
| 用 `wait.sh` 輪詢 port，port 通了不代表 RPC 已經可用 | 在 `geth` 加 `healthcheck`（例如打 `eth_blockNumber`），搭配 `depends_on: condition: service_healthy` |
| 本地單一 compose 檔裡，測試不知道 setup 何時跑完 | Rundler 用 `depends_on: geth_setup: condition: service_completed_successfully`；或改用 `docker compose up --wait` |
| CI 的 setup job 失敗時，錯誤訊息埋在 log 裡 | `up --abort-on-container-exit --exit-code-from geth_setup`，讓 setup 失敗直接讓該步驟失敗 |
| 每次 CI 都要重新 clone 合約 repo 並編譯 | 把部署好的鏈狀態或編譯產物做成 image / cache；或用 Geth 的 `--dev` + 自訂 genesis，把合約直接寫進 genesis 的 `alloc` |
| 合約地址寫死在三個地方（setup 腳本、Bundler 設定、測試 helper） | 抽成一份共用的地址設定檔，或改用 `CREATE2` 讓地址只跟 bytecode 相關 |
| `version: "3.8"` | Compose V2 已不需要，可以拿掉 |
| `--build` | 這些 service 都直接用 image、沒有 `build:`，加了沒有作用 |
| CI 沒有在結束時清理 | GitHub-hosted runner 每次都是新的 VM，不清也沒關係；self-hosted runner 則要加一個 `if: always()` 的 `docker compose down -v` |

## 總結

在本地起一條 infra testnet 的核心概念：

1. **用真的客戶端**：Geth dev mode 的 RPC 行為跟主網節點一致，Bundler 這類依賴 `debug_traceCall` 的 infra 才能正常運作。
2. **常駐服務 + 一次性 setup job**：鏈和 infra 用 image 起來，初始狀態用真實交易建立。
3. **確定性**：全新的鏈 + 固定 deployer + 固定部署順序 → 固定的合約地址；Bundler 手動模式 → 固定的打包時機；pin 住合約 commit → 固定的合約版本。
4. **測試自己隔離狀態**：沒有 snapshot/revert，就用隨機 salt 和隨機 owner，並循序執行避免 nonce 衝突。
5. **CI 跑同一套流程**：把常駐服務和 setup job 拆開，用前景執行的 setup 當作「部署完成」的同步點。
