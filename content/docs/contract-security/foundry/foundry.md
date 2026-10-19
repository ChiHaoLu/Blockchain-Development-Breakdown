---
title: "✅ Introduction of Foundry"
---

-   [How To Use Foundry To PoC Bug Leads, Part 1](https://medium.com/immunefi/how-to-use-foundry-to-poc-bug-leads-part-1-214c9c02ff30)

> Foundry 更新的速度遠比我想像中快，不過是一個月沒看而已，很多東西都完全長得不一樣了，所以大家如果遇到任何問題可以先參考一下 [Reference 中的官方文件們。](#Foundry-Official-DocGithub)

* * *

## Cast an eye over the "Testing with Foundry"

### What features can we use in Foundry

Foundry 由以下兩者組成：

-   [**Forge**](https://github.com/gakonst/foundry/tree/master/forge)： 和我們平常使用的其他開發工具一樣，是一個 Ethereum 的測試框架。
-   [**Cast**](https://github.com/gakonst/foundry/tree/master/cast)：支援多種客戶端功能，像是與 EVM 智能合約互動、傳遞交易、取得鏈上資訊等，就如同一把瑞士刀（官方文件寫的）。

來自官方的 Foundry 特性：

-   快速且彈性的編譯 Pipeline
    -   自動偵測並下載 Solidity 不同版本的編譯器（under ~/.svm）
    -   增量編譯和緩存: 只有被修改的檔案會被重新編譯
    -   並行編譯
    -   支援非特定的目錄結構（e.g. Hardhat repos）
-   以 Solidity 撰寫測試
-   快速的 Fuzz testing，能夠收斂到最小的輸入，並輸出其反例
-   快速的遠端 RPC 分岔模式, 利用類似 tokio 的 Rust 異步運行架構
-   彈性的 debug 紀錄輸出（logging）
    -   Dapptools-style: DsTest's emitted logs
    -   Hardhat-style: console.sol contract
-   非常輕量（5-10MB），不需要 Nix 之類的套件管理器
-   能利用 [foundry-toolchain](https://github.com/foundry-rs/foundry-toolchain) 以 Foundry GitHub Action 快速的 CI（持續性整合）

### Preparation

如果作業系統是 Linux 或 macOS 最簡單的方法就是使用以下方法下載 Foundry：

```javascript
curl -L https://foundry.paradigm.xyz | bash
foundryup
```

下載完成之後再執行一次 `foundryup` 會將 Foundry 更新至最新版本，如果想要返回到指定版本，則使用指令 `foundryup -v $VERSION`。

然而我自己是使用 Windows，下載的方式如下。

在下載 Foundry 之前得先擁有 Rust 和 Cargo，首先到 rustup.rs 下載 rust，然後執行：

```javascript
rustup-init
```

這樣就能同時準備好 Rust 和 Cargo，最後打開 CMD 使用以下指令安裝 Foundry。

```javascript
cargo install --git https://github.com/foundry-rs/foundry foundry-cli anvil --bins --locked
```

下載成功以後在電腦的某個地方使用 `init` 初始化一個專案。

```javascript
$ forge init defi-testing
```

forge CLI 將會創建兩個檔案目錄：`lib` 和 `src`。

-   **`lib`** 利用了 [git submodules](https://git-scm.com/book/en/v2/Git-Tools-Submodules) 來管理 [dependencies](https://book.getfoundry.sh/projects/dependencies.html)，包含：
    -   `ds-test` 中的 testing contract (lib/ds-test/src/test.sol)
    -   各式各樣測試合約的實作 demo(lib/ds-test/demo/demo.sol)
    -   和其他我們下載的 dependencies，例如：`forge-std`、`weird-erc20`、`solmate`
-   **`src`** 放了我們寫的智能合約和測試的原始碼

```javascript
.
├── foundry.toml
├── lib
│   ├─ds-test
│   │  ├─demo
│   │  └─src
│   └── forge-std
│       ├── lib
│       ├── LICENSE-APACHE
│       ├── LICENSE-MIT
│       ├── README.md
│       └── src
└── src
    ├── Contract.sol 
    └── test
        └──Contract.t.sol
```

之後一樣在終端機的部分，輸入指令：

```javascript
$ forge install OpenZeppelin/openzeppelin-contracts
>
Installing openzeppelin-contracts in "C:\\Users\\qazws\\Desktop\\Blockchain\\defi-testing\\lib\\openzeppelin-contracts", (url: https://github.com/OpenZeppelin/openzeppelin-contracts, tag: None)
```

便可以在 `lib` 中看見 OpenZeppelin 的合約們。

在 `foundry.toml` 裡面決定 Foundry 的運行設定，包含 Remap 我們 import 或執行命令的路徑，以下列出一些常用的參數：

```javascript
[default]
src = 'src'                                                   # the source directory
test = 'test'                                                 # the test directory
out = 'out'                                                   # the output directory (for artifacts)
libs = ['lib']                                                # a list of library directories
remappings = ['ds-test/=lib/ds-test/src/', 
              "@openzeppelin/=lib/openzeppelin-contracts/"]   # a list of remappings
evm_version = 'london'                                        # the evm version (by hardfork name)
#solc_version = '0.8.10'                                      # override for the solc version (setting this ignores `auto_detect_solc`)
sender = '0xB42faBF7BCAE8bc5E368716B568a6f8Fdf3F84ec'         # the address of `msg.sender` in tests
tx_origin = '0x00a329c0648769a73afac7f9381e08fb43dbea72'      # the address of `tx.origin` in tests
initial_balance = '0xffffffffffffffffffffffff'                # the initial balance of the test contract
gas_limit = 9223372036854775807                               # the gas limit in tests
gas_price = 0                                                 # the gas price (in wei) in tests
block_timestamp = 0                                           # the value of `block.timestamp` in tests
gas_reports = ["*"]    
```

更多詳細內容可查看以下[連結](https://github.com/gakonst/foundry/tree/master/config)。

* * *

## "Brewing" Time - Basic Defi Project

全文的原始碼[在此](https://github.com/ChiHaoLu/DeFi-Testing-With-Foundry)。

### Implementation - Simple Staking Contract

三個平行合約輔以 `ERC20`、`Ownable` 和 `safeMath` 等函式庫的陽春 DeFi Staking。基本上就是 User 可以透過抵押 stableCoin，換取抵押時間計算而得的 holdToken 收益。

#### Contract.sol

```solidity
// SPDX-License-Identifier: MIT
pragma solidity >=0.8.0;

import "./StableCoin.sol";
import "./LP.sol";
import "./safeMath.sol";
import "./Ownable.sol";

contract Farm is Ownable {
    LP public holdToken;
    StableCoin public dai;

    constructor(LP _holdToken, StableCoin _dai) {
        holdToken = _holdToken;
        dai = _dai;
    }

    /** ---------------- Constructs the Data Structures ---------------- */

    struct ClientInfo {
        uint startTime;
        uint stakingBalance;
        uint yieldBalance;
        bool isStaking;
    }

    mapping(address => ClientInfo) public ClientList;

    /** ---------------- Getter Function ---------------- */

    function getClientStartTime(address _addr) view public returns(uint){
        return ClientList[_addr].startTime;
    
    // pass...

    /** ---------------- Algorithms ---------------- */

    function stakeTokens(uint _amount) public {
       // pass...
    }

    function calYield(address _address) public view returns(uint){
       // pass...
    }

    function withdrawYield() public {
       // pass...
    }

    function unstakeTokens() public {
       // pass...
}
```

#### StableCoin.sol

```solidity
pragma solidity >=0.8.0;

import "@openzeppelin/contracts/token/ERC20/ERC20.sol";

contract StableCoin is ERC20 {

    uint256 public initialSupply = 10000;
    constructor() ERC20("TestDAI", "tDAI") {
        _mint(msg.sender, initialSupply);
    }
}
```

#### LP.sol

```solidity
pragma solidity >=0.8.0;

import "@openzeppelin/contracts/token/ERC20/ERC20.sol";

contract LP is ERC20 {

    uint256 public initialSupply = 10000;
    constructor() ERC20("MyToken", "MT") {
        _mint(msg.sender, initialSupply);
    }
}
```

* * *

## "Tasting" Time - Unit Testing

### Initialization & First Testing

開始 Foundry 的測試時，`setUp()` 會是測試開始的切入點，每一個「測試函式開始前」都會特別為其「設置」一個初始狀態，也就是 `setUp()` 中的內容。

```solidity
// SPDX-License-Identifier: MIT
pragma solidity >= 0.8.10;

import "forge-std/Test.sol";
import "../Contract.sol";
import "../StableCoin.sol";
import "../LP.sol";

contract FarmTest is Test {

    Farm public farm;
    LP public holdToken;
    StableCoin public dai;

    address DEPLOYER_ADDRESS;

    function setUp() public {
        holdToken = new LP();
        dai = new StableCoin();
        farm = new Farm(holdToken, dai);
        DEPLOYER_ADDRESS = farm.owner(); // (DEPLOYER == address(this)) != (msg.sender == <sender_in_foundry.toml>)
    }
    
    function testOwner() public {
        assertEq(DEPLOYER_ADDRESS, farm.owner());
    }

    function testMockContractInit() public {
        // Initial Mint
        assertEq(holdToken.balanceOf(DEPLOYER_ADDRESS), holdToken.initialSupply());
        assertEq(dai.balanceOf(DEPLOYER_ADDRESS), holdToken.initialSupply());
    }

    function testMockContractTransferFrom(uint256 _amount) public {
        vm.assume(_amount <= holdToken.initialSupply() && _amount <= dai.initialSupply());

        holdToken.approve(DEPLOYER_ADDRESS, _amount);
        holdToken.transferFrom(DEPLOYER_ADDRESS, address(1), _amount);
        assertEq(holdToken.balanceOf(address(1)), _amount);

        dai.approve(DEPLOYER_ADDRESS, _amount);
        dai.transferFrom(DEPLOYER_ADDRESS, address(1), _amount);
        assertEq(dai.balanceOf(address(1)), _amount);
    }
}
```

這邊主要測試 Owner 和兩個 ERC-20 合約的運作是否正常。

```javascript
$ forge test
>
[⠆] Compiling...
[⠃] Compiling 4 files with 0.8.10
[⠊] Solc 0.8.10 finished in 2.79s
Compiler run successful (with warnings)

[PASS] testMockContractInit() (gas: 21400)
[PASS] testMockContractTransferFrom(uint256) (runs: 256, μ: 95003, ~: 107435)
[PASS] testOwner() (gas: 9852)

Test result: ok. 3 passed; 0 failed; finished in 0.64s
```

需要注意的點有：

1.  `FarmTest` 裡面我們在 `setup()` 以 `new` 宣告合約之後，可取得 LP 和 StableCoin 的地址作為 `Farm` 的 `Constructor` 參數傳入
2.  `address(this)` 是測試合約本身，也就是 `FarmTest`
3.  在 `setup()` 佈署 LP、StableCoin 和 Farm 這些合約的 Deployer 是 FarmTest 這個測試合約本身：`<contract_deployer> == address(this)`
4.  使用 Solidity 來寫測試時，我們並不是透過 EOA 來 sign 一個合約（這個情況下 signer 是 msg.sender），所以 msg.sender 會需要是一個預設的值：`msg.sender == <sender_in_foundry.toml>`
5.  `<contract_deployer> != msg.sender`

在 Foundry 中如果需要 Gas Report 可以使用以下指令：

```javascript
$ forge test --gas-report
```

### More features can use

Foundry 同樣也支持 [Fuzzing](https://en.wikipedia.org/wiki/Fuzzing) 測試。因為當我們一個一個函式都進行測試時，即便全部都成功 PASS，但在邊際測資中其實也很有可能會出現一些問題，導致 Under/Overflow 或其他 RuntimeError/Memory Leak 之類的錯誤。

我們在測試函式中增加參數之後，Fuzzing 能夠讓 Solidity test runner 隨機選擇大量的參數輸入我們的函式。

```solidity
function testDoubleWithFuzzing(uint256 x) public {
    foo.set(x);
    require(foo.x() == x);
    foo.double();
    require(foo.x() == 2 * x);
}
```

在以上例子中 fuzzer 會自動地對 `x` 嘗試各種隨機數，如果他發現當前輸入會導致測試失敗，便會回傳錯誤，這時候就可以開始 debug 啦！

進行測試：

```javascript
$ forge test
>
Compiling...
Compiling 1 files with 0.8.10
Compiler run successful

Running 3 tests for FooTest.json:FooTest
[32m[PASS][0m testDouble() (gas: 9384)
[31m[FAIL. Reason: Arithmetic over/underflow. Counterexample: calldata=0xc80b36b68000000000000000000000000000000000000000000000000000000000000000, args=[57896044618658097711785492504343953926634992332820282019728792003956564819968]][0m testDoubleWithFuzzing(uint256) (runs: 4, μ: 2867, ~: 3823)
[32m[PASS][0m testFailDouble() (gas: 9290)

Failed tests:
[31m[FAIL. Reason: Arithmetic over/underflow. Counterexample: calldata=0xc80b36b68000000000000000000000000000000000000000000000000000000000000000, args=[57896044618658097711785492504343953926634992332820282019728792003956564819968]][0m testDoubleWithFuzzing(uint256) (runs: 4, μ: 2867, ~: 3823)

Encountered a total of [31m1[0m failing tests, [32m2[0m tests succeeded
```

從以上錯誤會發現當參數輸入為 `57896044618658097711785492504343953926634992332820282019728792003956564819968` 之後會出現錯誤，來到 [wolframe](https://www.wolframalpha.com/) 貼上這個數字會發現其為 `5.789 * 10^76 ~= 2^255`。

聽起來十分合理因為 `x` 的型態是 `uint256`，所以如果將其乘於 2 以後就會超過 `uint256` 的型態範圍！

未來 Foundry 除了 Fuzz Testing 之外，還會支援：

-   Invariant Testing
-   Symbolic Execution
-   Mutation Testing

:::info New Features 可以在這兩個 Repo 找到：

-   [forge package](https://github.com/gakonst/foundry/blob/master/forge/README.md)
-   [CLI README](https://github.com/gakonst/foundry/blob/master/cli/README.md). :::

### Cheating with Standard Library

```javascript
$ forge install foundry-rs/forge-std
```

下載了 Standard Library 之後在 `Contract.t.sol` 我們就改繼承 `Test.sol` 不用 `ds-test` 的 `test.sol`。

以下節錄自 `forge-std/Test.sol` 的原始碼，可以發現已經實作了 `ds-test`、`Vm.sol` 和 `console.sol` 這些我們需要的部分。

```solidity
// SPDX-License-Identifier: Unlicense
pragma solidity >=0.6.0 <0.9.0;

import "./Vm.sol";
import "ds-test/test.sol";
import "./console.sol";
import "./console2.sol";

// Wrappers around Cheatcodes to avoid footguns
abstract contract Test is DSTest {
    using stdStorage for StdStorage;

    uint256 private constant UINT256_MAX = 115792089237316195423570985008687907853269984665640564039457584007913129639935;

    event WARNING_Deprecated(string msg);

    Vm public constant vm = Vm(HEVM_ADDRESS);
    StdStorage internal stdstore;

    /*//////////////////////////////////////////////////////////////////////////
                                    STD-CHEATS
    //////////////////////////////////////////////////////////////////////////*/
    
    // ...
}
```

特別是：

```solidity
Vm public constant vm = Vm(HEVM_ADDRESS);
```

在宣告以後便可以使用 `vm`，他是 Foundry 中的 CheatingCode，可用於模擬「該 Test Function 中」的 EVM 和區塊鏈狀況，例如：

-   `vm.deal` 可用於預設一個地址擁有一定數量的代幣（例如 `deal(address(dai), address(alice), 10000e18);`）
-   `vm.warp` 可以指定 `block.timestamp` 等。

### msg.sender in Foundry

`msg.sender` 在 Foundry 中是一個特別重要的存在，是過往用其他語言寫測試比較少注意到的部分。

大家還記得之前的 `foundry.toml` 嗎！如果我們在裡面加上參數 `sender` 就可以指定在合約測試時預設的 `msg.sender`：

```javascript
[default]
src = 'src'
out = 'out'
libs = ['lib']
remappings = ['forge-std/=lib/forge-std/src/','ds-test/=lib/ds-test/src/', "@openzeppelin/=lib/openzeppelin-contracts/"]
sender = '0xB42faBF7BCAE8bc5E368716B568a6f8Fdf3F84ec'
block_timestamp = 0

# See more config options https://github.com/gakonst/foundry/tree/master/config
```

從官方文件整理的函式比較表： | [OriginalCheatcode](https://book.getfoundry.sh/cheatcodes/prank.html) |Statement | [related Forge-STD](https://book.getfoundry.sh/reference/forge-std/std-cheats.html) | | -------- | -------- | -------- | | `prank(address)` | Sets `msg.sender` to the specified address for the next call. "The next call" includes static calls as well, but not calls to the cheat code address. |`hoax` | | `startPrank(address)` | Sets `msg.sender` for all subsequent calls until `stopPrank` is called. | `startHoax`, `changePrank` | | `stopPrank()` | Stops an active prank started by `startPrank`, resetting `msg.sender` and `tx.origin` to the values before `startPrank` was called. | |

在 Foundry-STD 中也可以使用 `console.log` 的模擬環境，需要注意的是 `prank()` 只適用於**下一個 external call**，而, `console.log` 並不是 external call 所以沒辦法印出我們想像中的地址。

舉例來說在測試開始前的 `setup()` 中，我們想要假裝由一個 EOA(`address(deployer)`) 來 Deploy 合約，而不是和上面 `FarmTest` 一樣的使用 `FarmTest` 這個合約本身來 Deploy：

```solidity
function setUp() public {
    vm.startPrank(address(deployer));
    deployedContract = new MyContract();
    vm.stopPrank();
}
```

以上這個小例子的結果是：對 MyContract 這個合約來說，他的 Constructor 會認定 `msg.sender`，也就是 `address(deployer)` 是他的 owner。

大致了解了 `vm.prank()` 的功能之後，我們可以回到 `FarmTest` 來看第一個 Prank 測試：

這個測試的目的在觀察合約 Owner 被轉換之後，用 prank 的方式觀察「最一開始的 Deployer」是否還是能成功送出 `transferOwnership`。我們的預期是不行，因為 Ownership 已經被轉移給別人，所以我們使用 `vm.expectRevert`。

```solidity
/** Unit Testing For Mock Contracts*/

    function testPrank1() public {
        assertEq(DEPLOYER_ADDRESS, farm.owner()); // now owner() is DEPLOYER
        farm.transferOwnership(msg.sender); 
        // the transaction originator of transferOwnership is the "contract" ---> DEPLOYER == address(this)  
        assertEq(msg.sender, farm.owner()); // transfer successfully
        // now owner is the "msg.sender" ---> <sender_in_foundry.toml>

        vm.prank(DEPLOYER_ADDRESS);  // change the "msg.sender" ---> DEPLOYER == address(this)
        vm.expectRevert(farm.transferOwnership(msg.sender));

        // The most important thing is that the prank is only useful for "external" call
        // the only "external" call above is "farm.transferOwnership()"
    }
```

再來看看另外一個測試：

`msg.sender` 在測試檔案中是一個會呼叫每個 test function 的 EOA。而 `prank()` 是一個 test function 中的函式，目的是去「改變 external call 的 caller」，並不會向外影響到整個測試檔的 `msg.sender`，因此沒辦法影響到不是 external call 的對象，例如：`assertEq`。

```solidity
    function testPrank2() public {
        assertEq(msg.sender, 0xB42faBF7BCAE8bc5E368716B568a6f8Fdf3F84ec); //[PASS]
        assertEq(DEPLOYER_ADDRESS, address(this)); // [PASS]
        assertEq(DEPLOYER_ADDRESS, farm.owner()); // [PASS]
        /**
        vm.prank(DEPLOYER_ADDRESS);
        assertEq(DEPLOYER_ADDRESS, msg.sender); // [Failed] 
            ---> Because "assertEq()" is not external call
         */
    }
```

### Unit Testing

超級陽春的把四個函式測試一次，基本上這裡沒有實作太花俏的內容，比較需要注意的點是關於兩種代幣的模型，在設計上包含供給量得特別注意，但由於是 Mock 來示範地所以沒有特別著墨。

#### testStaking

合約原始碼：

```solidity
    function stakeTokens(uint _amount) public {
        require(_amount > 0, 'You cannot stake 0 tokens');

        uint oldDaiBal = dai.balanceOf(msg.sender);
        require( oldDaiBal > _amount, "insufficient DAI!");

        uint256 allowance = dai.allowance(msg.sender, address(this));
        require(allowance >= _amount, "Check the token allowance");
        
        dai.transferFrom(msg.sender, address(this), _amount);
        require(dai.balanceOf(msg.sender) == oldDaiBal - _amount, "Transfer Failed!");
        require(dai.balanceOf(address(this)) == _amount, "Transfer Failed!");

        uint oldBalance = ClientList[msg.sender].stakingBalance;
        ClientList[msg.sender].stakingBalance = SafeMath.add(ClientList[msg.sender].stakingBalance, _amount);
        require(ClientList[msg.sender].stakingBalance > oldBalance, "Staking Bug!");

        ClientList[msg.sender].startTime = block.timestamp;
        ClientList[msg.sender].isStaking = true;
    }
```

相對應的測試：

特別注意模擬使用者情境的時候該在 Dapp 實作的部分要補上，例如 `approve()`。關於 Approve 和 Transfer 的用法與使用時機參考：

-   [EIP-20: Token Standard](https://eips.ethereum.org/EIPS/eip-20)
-   [TRANSFERS AND APPROVAL OF ERC-20 TOKENS FROM A SOLIDITY SMART CONTRACT](https://ethereum.org/zh-tw/developers/tutorials/transfers-and-approval-of-erc-20-tokens-from-a-solidity-smart-contract/)

此外由於要符合我們代幣模型的設計，使用 `vm.assume` 來指定變數性質，例如以下測試中我們規定 testing 時輸入的參數大小不可以超過供應量（不然就沒有足夠的 balance 啦）。

```solidity
    function testStaking(uint256 _amount) public {
        vm.assume(_amount > 0 && _amount <= holdToken.initialSupply() && _amount <= dai.initialSupply());
        assertEq(dai.balanceOf(DEPLOYER_ADDRESS), dai.initialSupply());

        vm.startPrank(DEPLOYER_ADDRESS);
        dai.approve(address(farm), _amount);
        farm.stakeTokens(_amount);
        assertEq(dai.balanceOf(DEPLOYER_ADDRESS), dai.initialSupply() - _amount);
        assertEq(farm.getClientStakingBalance(DEPLOYER_ADDRESS), _amount);
        assertEq(farm.getClientStartTime(DEPLOYER_ADDRESS), block.timestamp);
        assertEq(farm.getClientYieldBalance(DEPLOYER_ADDRESS), 0);
        assertEq(farm.getClientIsStaking(DEPLOYER_ADDRESS), true);
        vm.stopPrank();
    }
```

#### testCalYield

合約原始碼：

```solidity
    function calYield(address _address) public view returns(uint){
        uint end = block.timestamp;
        uint totalTime = SafeMath.sub(end, ClientList[_address].startTime);
        return SafeMath.div(totalTime, 60);
        // Yield Per Minute
    }
```

相對應的測試：

```solidity
    function testCalYield(uint _amount, uint32 _timeRoll) public {
        vm.assume(_amount > 0 && _amount <= holdToken.initialSupply() && _amount <= dai.initialSupply());
        vm.assume(_timeRoll < 2**32);
        assertEq(dai.balanceOf(DEPLOYER_ADDRESS), dai.initialSupply());

        vm.startPrank(DEPLOYER_ADDRESS);
        // Stake
        dai.approve(address(farm), _amount);
        farm.stakeTokens(_amount);
        assertEq(dai.balanceOf(DEPLOYER_ADDRESS), dai.initialSupply() - _amount);
        assertEq(farm.getClientStakingBalance(DEPLOYER_ADDRESS), _amount);
        assertEq(farm.getClientStartTime(DEPLOYER_ADDRESS), block.timestamp);
        assertEq(farm.getClientYieldBalance(DEPLOYER_ADDRESS), 0);
        assertEq(farm.getClientIsStaking(DEPLOYER_ADDRESS), true);

        // CalYield
        vm.warp(_timeRoll);
        uint result = SafeMath.div(SafeMath.sub(_timeRoll, farm.getClientStartTime(DEPLOYER_ADDRESS)), 60);
        assertEq(farm.calYield(DEPLOYER_ADDRESS), result);

        vm.stopPrank();
    }
```

#### testWithdrawYield

合約原始碼：

```solidity
    function withdrawYield() public {

        uint profit = calYield(msg.sender);
        uint withdraw = SafeMath.div(SafeMath.mul(ClientList[msg.sender].stakingBalance, profit), 100);

        if(ClientList[msg.sender].yieldBalance > 0){
            uint originalYBal = ClientList[msg.sender].yieldBalance;
            ClientList[msg.sender].yieldBalance = 0;
            withdraw = SafeMath.add(withdraw, originalYBal);
        }

        if(withdraw == 0 && ClientList[msg.sender].yieldBalance == 0){
            return ;
        }

        ClientList[msg.sender].startTime = block.timestamp;
        holdToken.transfer(msg.sender, withdraw);
    }
```

相對應的測試：

```solidity
    function testWithdrawYield(uint256 _amount, uint _timeRoll) public {
        vm.assume(_amount > 0 && _amount <= holdToken.initialSupply() && _amount <= dai.initialSupply());
        assertEq(dai.balanceOf(DEPLOYER_ADDRESS), dai.initialSupply());

        vm.startPrank(DEPLOYER_ADDRESS);
        // Stake
        dai.approve(address(farm), _amount);
        farm.stakeTokens(_amount);
        assertEq(dai.balanceOf(DEPLOYER_ADDRESS), dai.initialSupply() - _amount);
        assertEq(farm.getClientStakingBalance(DEPLOYER_ADDRESS), _amount);
        assertEq(farm.getClientStartTime(DEPLOYER_ADDRESS), block.timestamp);
        assertEq(farm.getClientYieldBalance(DEPLOYER_ADDRESS), 0);
        assertEq(farm.getClientIsStaking(DEPLOYER_ADDRESS), true);

        // withdrawYield
        vm.assume(_timeRoll < 2**8); 
        // here is a risk of that holdtoken.totalSupply < withdraw, 
        // this defi should hava a better Tokenomics Model
        vm.warp(_timeRoll);
        farm.withdrawYield();
        uint withdraw = SafeMath.add(
                            SafeMath.div(
                                SafeMath.mul(farm.getClientStakingBalance(DEPLOYER_ADDRESS), 
                                    SafeMath.div(
                                        SafeMath.sub(_timeRoll, farm.getClientStartTime(DEPLOYER_ADDRESS))
                                    , 60))
                            , 100)
                        , farm.getClientYieldBalance(DEPLOYER_ADDRESS));
        
        if(withdraw > 0 || farm.getClientYieldBalance(DEPLOYER_ADDRESS) > 0){
            assertEq(holdToken.balanceOf(DEPLOYER_ADDRESS), withdraw);
            assertEq(farm.getClientYieldBalance(DEPLOYER_ADDRESS), 0);
            assertEq(farm.getClientStartTime(DEPLOYER_ADDRESS), _timeRoll);
        }
        vm.stopPrank();

        // Stake Status Check Again
        assertEq(dai.balanceOf(DEPLOYER_ADDRESS), dai.initialSupply() - _amount);
        assertEq(farm.getClientStakingBalance(DEPLOYER_ADDRESS), _amount);
        assertEq(farm.getClientIsStaking(DEPLOYER_ADDRESS), true);
    }
```

#### testUnStaking

合約原始碼：

```solidity
    function unstakeTokens() public {
        require(ClientList[msg.sender].isStaking, 'You are not staker!');
        
        withdrawYield();
        
        uint balance = ClientList[msg.sender].stakingBalance;
        require(balance > 0, "There is no fund in your staking account!");
        
        // need to prevent re-entrancy attack later!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!
        dai.transfer(msg.sender, balance);
        ClientList[msg.sender].stakingBalance = 0;
        ClientList[msg.sender].isStaking = false;
    }
```

相對應的測試：

```solidity
    function testUnStaking(uint256 _amount) public {
        vm.assume(_amount > 0 && _amount <= holdToken.initialSupply() && _amount <= dai.initialSupply());
        assertEq(dai.balanceOf(DEPLOYER_ADDRESS), dai.initialSupply());

        vm.startPrank(DEPLOYER_ADDRESS);
        // Stake
        dai.approve(address(farm), _amount);
        farm.stakeTokens(_amount);
        assertEq(dai.balanceOf(DEPLOYER_ADDRESS), dai.initialSupply() - _amount);
        assertEq(farm.getClientStakingBalance(DEPLOYER_ADDRESS), _amount);
        assertEq(farm.getClientStartTime(DEPLOYER_ADDRESS), block.timestamp);
        assertEq(farm.getClientYieldBalance(DEPLOYER_ADDRESS), 0);
        assertEq(farm.getClientIsStaking(DEPLOYER_ADDRESS), true);

        // Unstake
        farm.unstakeTokens();
        assertEq(dai.balanceOf(DEPLOYER_ADDRESS), dai.initialSupply());
        assertEq(farm.getClientStakingBalance(DEPLOYER_ADDRESS), 0);
        assertEq(farm.getClientStartTime(DEPLOYER_ADDRESS), block.timestamp);
        assertEq(farm.getClientYieldBalance(DEPLOYER_ADDRESS), 0);
        assertEq(farm.getClientIsStaking(DEPLOYER_ADDRESS), false);
        vm.stopPrank();
    }
```

* * *

## Tipsy - Coclusion & Reference

### Conclusion

大家也可以使用多個 mockAddress 來做交互測試，不一定要用 test Contract 本身當 receiver 或 sender，但本文並沒有實作這個方法。

如果對 Foundry 有一些小問題，或者是想了解一些補充內容可以看[這裡](https://github.com/ChiHaoLu/Foundry_de-problemList)！

### Reference & Citation

-   [TESTING SMART CONTRACTS](https://ethereum.org/en/developers/docs/smart-contracts/testing/)
-   [Maximilian Wohrer and Uwe Zdun, “DevOps for Ethereum Blockchain Smart Contracts,”](http://eprints.cs.univie.ac.at/7141/1/document.pdf)

#### DeFi Testing

-   [Securing Your DeFi Project Starts with Quality Testing](https://quantstamp.com/blog/securing-your-defi-project-starts-with-quality-testing)
-   [Evaluating Smart Contract Security for Decentralized Finance (DeFi)](https://www.apriorit.com/business-case-studies-list/747-evaluating-smart-contract-security-for-defi)
-   [Testing Chainlink Smart Contracts](https://blog.chain.link/testing-chainlink-smart-contracts/)
-   [defi ENGINEERING: A CULT OF QUALITY](https://defisolutions.com/general-news/2017/05/16/defi-engineering-cult-quality/)
-   [HOW TO BUILD A SUCCESSFUL DEFI PROJECT?](https://blaize.tech/article-type/how-to-build-a-successful-defi-project/#Project-Testing)
-   [DEFI SECURITY AUDIT: HOW TO PREVENT YOUR DEFI PROJECT FROM HACKING?](https://blaize.tech/article-type/defi-security-how-to-prevent-your-defi-project-from-hacking/)

#### Foundry Official Doc./Github

-   [Foundry Book](https://book.getfoundry.sh/index.html)
-   [foundry-rs/foundry](https://github.com/foundry-rs/foundry)
-   [foundry-rs/forge-std](https://github.com/foundry-rs/forge-std)

#### Foundry Resources

-   [How to Foundry with Brock Elmore](https://www.youtube.com/watch?v=Rp_V7bYiTCM)
-   [crisgarner/awesome-foundry](https://github.com/crisgarner/awesome-foundry?fbclid=IwAR2ypJ1Pj1EpTmoFmT5OuqTGDHR-ce0yFsdFMyVdiY3Hg08MSNJV8whN0Ss)
-   [Intro to Foundry | The FASTEST Smart Contract Framework](https://www.youtube.com/watch?v=fNMfMxGxeag)
-   [Foundry Tutorial | How To Debug & Deploy Solidity Smart Contracts](https://jamesbachini.com/foundry-tutorial/#foundry-cheat-codes)
-   [Tic-Tac-Token-Foundry](https://book.tictactoken.co/chapters/1/setting-up-foundry.html)
-   [Rari-Capital/solmate](https://github.com/Rari-Capital/solmate/tree/main/src/test)
-   [ApeWorX/ape-foundry](https://github.com/ApeWorX/ape-foundry)
-   [SunWeb3Sec/DeFiHackLabs](https://github.com/SunWeb3Sec/DeFiHackLabs)

#### DeFi Protocol

-   [Python\_\_\_tradingstrategy-ai/web3-ethereum-defi](https://github.com/tradingstrategy-ai/web3-ethereum-defi/tree/master/tests)
-   [Hardhat\_\_\_yieldprotocol/yield-liquidator-v2](https://github.com/yieldprotocol/yield-liquidator-v2/blob/master/test/test_flashLiquidator.ts)
-   [Foundry\_\_\_sense-finance/space-v1](https://github.com/sense-finance/space-v1/tree/main/src/tests)
-   [Hardhat\_\_\_pendle-finance/pendle-core](https://github.com/pendle-finance/pendle-core/tree/master/test)
-   [Truffle\_\_\_tranche-jibrel/tranche-compound-protocol](https://github.com/tranche-jibrel/tranche-compound-protocol/tree/master/test)
-   [Ethers\_\_\_notional-finance/contracts](https://github.com/notional-finance/contracts/tree/master/test)
-   [Hardhat\_\_\_element-fi/elf-contracts](https://github.com/element-fi/elf-contracts/tree/main/test)
-   [Hardhat\_\_\_BarnBridge/BarnBridge-YieldFarming](https://github.com/BarnBridge/BarnBridge-YieldFarming/tree/master/test)
-   [Hardhat\_\_\_BarnBridge/BarnBridge-SmartYieldBonds](https://github.com/BarnBridge/BarnBridge-SmartYieldBonds/tree/master/test)
-   [Python\_\_\_XY-Finance/xy-protocol](https://github.com/XY-Finance/xy-protocol/blob/master/tests/test_client_swap.py)
-   [hakkafinance/blackholeswap](https://github.com/hakkafinance/blackholeswap/blob/master/contracts/blackholeswapV1.sol)

* * *

> 最後歡迎大家拍打餵食大學生[`0x2b83c71A59b926137D3E1f37EF20394d0495d72d`](https://etherscan.io/address/0x2b83c71A59b926137D3E1f37EF20394d0495d72d)
