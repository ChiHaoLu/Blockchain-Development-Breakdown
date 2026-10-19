---
title: "✅ Ethernaut with Foundry & 0. Hello Ethernaut"
---

## Ethernaut

### Intro.

> Ethernaut is a Web3/Solidity based wargame inspired in overthewire.org, to be played in the Ethereum Virtual Machine. Each level is a smart contract that needs to be 'hacked'.

The official game can be played over at ethernaut.openzeppelin.com. It runs on Etherereum testnet Rinkeby so instead, we will be deploying our own local instance.

Our setup will be based on the following two repository, credits to their respective authors:

Official repository: github.com/OpenZeppelin/ethernaut Template repository: github.com/ciaranmcveigh5/ethernaut-x-foundry

### Do in Foundry

首先在我們要的資料夾裡面初始化 Foundry 環境：

```
$ forge init
```

下載 [`ciaranmcveigh5/ethernaut-x-foundry`](https://github.com/ciaranmcveigh5/ethernaut-x-foundry/tree/main/src/test):

```
$ git clone https://github.com/ciaranmcveigh5/ethernaut-x-foundry/tree/main/src/test
```

這一步我們要把所有 `ethernaut-x-foundry/src` 中的檔案移到當初我們 `init` 的 `src` 資料夾中建立的 `ethernaut` 資料夾，移動完後的檔案長這樣：

```
$ cd src
$ tree
>
├─ethernaut
│  ├─AlienCodex
│  ├─CoinFlip
│  ├─Delegation
│  ├─Denial
│  ├─Dex
│  ├─DexTwo
│  ├─Elevator
│  ├─Fallback
│  ├─Fallout
│  ├─Force
│  ├─GatekeeperOne
│  ├─GatekeeperTwo
│  ├─King
│  ├─MagicNum
│  ├─Motorbike
│  ├─NaughtCoin
│  ├─Preservation
│  ├─Privacy
│  ├─PuzzleWallet
│  │  └─openzeppelin
│  ├─Recovery
│  ├─Reentrance
│  ├─Shop
│  ├─Telephone
│  ├─test
│  │  └─utils
│  ├─Token
│  └─Vault
└─test
```

其中 `src/ethernaut/test` 這個資料夾是我們從 `ethernaut-x-foundry/src` 中複製下來的解答們，大家可以先試試看不要看解答做題目喔，如果真的寫不出來再去看看提示吧！這邊我會選擇先把它們刪掉哈哈哈哈哈！

在 `foundry.toml` 中設定 remappings:

```
[profile.default]
src = 'src'
out = 'out'
libs = ['lib']
remappings = ['forge-std/=lib/forge-std/src/',
              'openzeppelin-contracts/=lib/openzeppelin-contracts/']

# See more config options https://github.com/foundry-rs/foundry/tree/master/config
```

* * *

## 0\. Hello Ethernaut

那首先在 `src/test` 中建立一個檔案 `00-HelloEthernaut.t.sol`:

```solidity
pragma solidity >=0.6.0 <0.9.0;

import "forge-std/Test.sol";
import "../ethernaut/Fallback/FallbackFactory.sol";
import "../ethernaut/Ethernaut.sol";

contract HelloEthernautTest is Test {
    function setUp() public {}

    function testExample() public {
        assertTrue(true);
    }
}

```

進行測試看有沒有正常抓到檔案們和一切有沒有問題！

```
$ forge test
>
Running 1 test for src\test\00-HelloEthernaut.t.sol:HelloEthernautTest
[PASS] testExample() (gas: 212)
Test result: ok. 1 passed; 0 failed; finished in 1.78ms
```

未來我們的所有解題模板都是以上這個框架，只是換了 `testFunction` 的 body 跟 `import` 的檔案而已！接下來就可以大寫特寫囉！

* * *

## Closing

### Reference

-   [Hello Ethernaut](https://ethernaut.openzeppelin.com/level/0x4E73b858fD5D7A5fc1c3455061dE52a53F35d966)
-   [OpenZeppelin/ethernaut](https://github.com/OpenZeppelin/ethernaut)
-   [Ethernaut x Foundry - 0x0 Hello Ethernaut](https://blog.0xeval.me/ethernaut-x-foundry-0x0-hello-ethernaut)
-   [ciaranmcveigh5/ethernaut-x-foundry](https://github.com/ciaranmcveigh5/ethernaut-x-foundry)

* * *

> 最後歡迎大家拍打餵食大學生[`0x2b83c71A59b926137D3E1f37EF20394d0495d72d`](https://etherscan.io/address/0x2b83c71A59b926137D3E1f37EF20394d0495d72d)
