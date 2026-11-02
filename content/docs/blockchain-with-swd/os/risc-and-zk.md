---
title: "RISC 跟 ZK 的關係：zkVM 與電路"
description: 為什麼 RISC Zero、SP1、Jolt 這些 zkVM 都挑 RISC-V？它跟傳統 ZK circuit 又是什麼關係
---

這篇回答一個常見的疑問：為什麼 ZK 圈最近常提到 **RISC-V**？它跟我們熟悉的 **ZK circuit (電路)** 又是什麼關係？結論先講：

- **RISC-V 本身不是 ZK 技術**，它是一個 CPU 指令集 (ISA)。
- 它跟 ZK 的連結是透過 **zkVM**：把 RISC-V CPU 的「每個 cycle 做了什麼」寫成一個電路，再對這個電路生成 ZK 證明。
- 所以答案是 **「對，跟 circuit 高度相關」**：zkVM 的 prover 其實就是在證明一個巨大的 RISC-V CPU 電路被正確執行了 N 個 cycle。

## 背景一：傳統 ZK 要寫 circuit

ZK proof system (Groth16、PLONK、STARK…) 的輸入不是程式碼，而是**算術電路 (arithmetic circuit)**，常見的表達形式有：

- **R1CS**：Groth16 用的格式，一組 $A \cdot B = C$ 形式的限制式。
- **PLONKish**：PLONK / Halo2 用的「gate + 查表 (lookup)」。
- **AIR**：STARK 用的 execution trace + 多項式約束。

早期 ZK 開發的做法是：

1. 用 **Circom / Noir / Halo2 / arkworks** 這種 DSL 手刻電路。
2. 把要證明的計算 (例如 Merkle proof、BLS 驗簽) 一條條約束寫出來。
3. 編譯成 R1CS / AIR，再丟給 proof system。

這種做法的痛點：

- **DSL 很小眾**：Circom、Cairo 不是通用語言，社群小。
- **寫起來像在寫組語**：沒有 `if/else`、沒有迴圈 (或要展開)、不能隨便用 `uint64` (field size 不夠)。
- **每寫一個新應用就要重做一次**：想把一個現成的 Rust / C library 搬到 ZK，幾乎等於重寫。
- **稽核難**：constraint 寫錯會造成 soundness bug，而不是普通的功能 bug。

## 背景二：RISC 是什麼

**RISC** = Reduced Instruction Set Computer，相對於 **CISC** (x86 這種)。特徵：

- **指令少、格式固定**：RISC-V base integer 指令集 (RV32I) 只有 ~40 個指令，長度都是 32-bit。
- **load/store 架構**：運算只對暫存器做，記憶體存取另外用 `lw` / `sw`。
- **沒有專利、開放規範**：RISC-V 由 UC Berkeley 發起，是開放標準。

常見的 RISC ISA：ARM、MIPS、RISC-V。對 ZK 來說最常見的是：

- **RISC-V**：RISC Zero、SP1、Jolt、Nexus、Powdr 都用這個。
- **MIPS**：Optimism 的 Cannon fault proof、zkMIPS 用這個。

## zkVM：把 CPU 寫進電路

**zkVM (Zero-Knowledge Virtual Machine)** 的核心想法：

> **我不要替每個應用都寫一次電路，我寫一次「CPU 的電路」就好。**
> 任何程式 (Rust、C、Go…) 都能編譯成這個 CPU 的指令，CPU 執行這些指令時產生一條 **execution trace**，我對這條 trace 生成 ZK 證明。

結構長這樣：

```
Rust / C 原始碼
   ↓ (rustc, llvm, 一般 compiler)
RISC-V ELF binary
   ↓ (zkVM runtime 執行)
Execution trace：每個 cycle 的 (pc, register, memory) 快照
   ↓ (prover 把 trace 轉成 constraints)
ZK proof：證明「這條 trace 是合法的 RISC-V 執行結果」
```

對開發者的體感：**不用學 DSL，直接寫 Rust/C，加上 `#![no_std]` 和幾個 host/guest macro 就能 ZK。**

### 跟 circuit 的關係：有，而且很直接

zkVM 底下仍然是電路，只是「電路長什麼樣」被固定住了：

- **指令電路 (instruction chip)**：每個 RISC-V 指令 (`ADD`、`SUB`、`LW`、`BEQ`…) 都寫成一個小電路，規範 input/output register 之間的約束。
- **狀態轉移約束**：第 $i$ cycle 的 (pc, registers, memory) 到第 $i+1$ cycle 的狀態，必須滿足「有一條指令合法地執行」。
- **記憶體一致性 (memory consistency)**：用 lookup argument / permutation argument 證明 read 讀到的是最近一次 write 的值。
- **程式載入 (program commitment)**：對 RISC-V binary 做 Merkle commitment，證明被執行的指令真的是這份 binary。

所以 zkVM 的證明本體就是一個 **「RISC-V CPU step circuit 複製 N 份」** 的巨大電路。開發者不碰電路，但電路一直都在。

### 為什麼挑 RISC 而不是 CISC

從電路設計的角度看：

| 面向 | RISC (RISC-V) | CISC (x86) |
| --- | --- | --- |
| 指令數量 | 幾十個 | 上千個，加上一堆延伸 |
| 指令長度 | 固定 (32-bit) | 1–15 bytes 不定 |
| 解碼複雜度 | 很小的電路就能 decode | 需要巨大的 decode table |
| 專利 / 授權 | 開放 | ARM、x86 有授權問題 |
| 工具鏈 | LLVM、GCC 支援完整 | 一樣完整，但 ISA 太大 |

ZK 電路的大小大致上跟「要被複製到每個 cycle 的 constraint 數量」成正比，所以 ISA 越小越好。RISC-V 大概是 **「夠通用、工具鏈完整、電路夠小、沒有授權問題」** 的交集最大解。

## 幾個主流 zkVM 比較

| zkVM | ISA | Proof system | 特點 |
| --- | --- | --- | --- |
| **RISC Zero** | RISC-V (RV32IM) | STARK + Groth16 wrapper | 最早推廣 zkVM 概念，有完整 Rust SDK |
| **SP1 (Succinct)** | RISC-V | STARK (FRI) | precompile 多，performance 強，開源友善 |
| **Jolt (a16z)** | RISC-V | Lasso lookup-based | 走「幾乎全部用 lookup」的路線，證明比較快 |
| **Nexus** | RISC-V | Nova / HyperNova (folding) | 用 folding scheme 做無限長度計算 |
| **zkMIPS / Cannon** | MIPS | STARK / fault proof | Optimism Bedrock fault proof 用 MIPS |

它們都在做同一件事：**把 ISA 寫成電路，讓程式碼不用改就能 ZK**。

## Precompile：zkVM 的「syscall」

純粹用 RISC-V 指令去跑 keccak、ECDSA 這類密碼學原語會很慢 (每個 32-bit 加法都是一個 cycle)。所以 zkVM 幾乎都提供 **precompile**：

- 在 guest 端，開發者呼叫一個特殊函式 (例如 `sp1_zkvm::syscalls::sha256`)。
- 在 prover 端，這段計算不用 RISC-V 指令去跑，而是**直接接到一個手刻的 keccak / sha256 / secp256k1 子電路**。
- 效果：單一 precompile 可能等於幾千個 RISC-V cycle，但只要一個 chip 的 constraints。

這就跟 OS 的 **syscall** 很像：normal CPU 指令跑不動或太慢的事 (I/O、crypto、特權操作)，交給 kernel 直接處理。zkVM 的「kernel」就是那堆手刻的 precompile 電路。

## 跟 zkEVM 的差別

常常有人把 zkVM 和 zkEVM 混在一起，簡短對比：

- **zkEVM** (Scroll、Polygon zkEVM、Linea、zkSync Era)：把 **EVM** 的 opcode (而不是 RISC-V 指令) 寫成電路。目標是直接證明一個 Ethereum block。
- **zkVM** (RISC Zero、SP1、Jolt)：把 **通用 CPU 的指令** 寫成電路。目標是任意 Rust / C 程式。

兩者可以結合：有些 team 把 EVM interpreter 用 Rust 寫，再放進 zkVM 跑，繞過自己寫 zkEVM circuit 的工程量 (RISC Zero / SP1 版本的 EVM proof)。這條路證明比較慢，但工程量小非常多。

## 重點整理

- **RISC 本身不是 ZK**：它只是 CPU ISA。
- **ZK 傳統上是在寫 circuit**：R1CS / PLONK / AIR 都是電路。
- **zkVM 用「CPU step 電路」當通用層**：把 RISC-V 執行過程寫成電路，於是任何能編成 RISC-V 的程式都能被證明。
- **挑 RISC-V 的原因是電路小 + 工具鏈完整 + 開放授權**。
- **Precompile = zkVM 版 syscall**：讓常用但昂貴的操作直接接到專屬電路，而不是用 RISC-V 指令跑。

一句話：**RISC-V 是 zkVM 的「指令集」，electric circuit 是 zkVM 的「實作底層」，兩者在 zkVM 這一層被接在一起。**

## 延伸閱讀

- [RISC Zero zkVM Overview](https://dev.risczero.com/api/zkvm/)
- [Succinct SP1 Documentation](https://docs.succinct.xyz/)
- [a16z crypto — Understanding Jolt](https://a16zcrypto.com/posts/article/understanding-jolt-clarifications-and-reflections/)
- [Justin Thaler — A technical FAQ on zkVMs](https://a16zcrypto.com/posts/article/a-technical-faq-on-lookup-arguments/)
- [RISC-V Specifications](https://riscv.org/technical/specifications/)
