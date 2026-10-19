---
title: "⚠️ Mathematical View"
---

Assume there are two types of ERC-20 tokens: tokenA and tokenB, and there is a Uniswap liquidity pool which has been created for swapping between tokenA and tokenB. We will explain how it is created later. For now, let’s say this tokenA-tokenB liquidity pool currently has 5 tokenA and 20 tokenB in it, so the ratio is 1 tokenA : 4 tokenB. And we assume that’s the current market ratio, meaning 1 tokenA is now worth 4 tokenB.

OK, now if trader Tim swaps his 1 tokenA for tokenB, the pool will take his 1 tokenA, transfer a certain amount of tokenB from the pool to Tim.

But how many tokenB will Tim receive after the swap? 4 tokenB? No, he will actually receive a bit less: 3.324996 tokenB instead. Uniswap determines the output token amount by using a constant product formula:

```
X * Y = K
```

The constant product formula requires the trades should not change the product (K) of a pair’s reserved balances (X and Y). Let’s walk through the calculation step by step.

Originally, the liquidity pool has 5 tokenA and 20 tokenB, so X = 5 and Y = 20. when Tim swaps 1 tokenA, he will pay a 0.3% fee first, which is 0.003 tokenA (0.3% \* 1). After the fee is paid, the remaining tokenA, which is 0.997 tokenA, will be swapped for tokenB, so the new X becomes 5.997 tokenA. Since K must remain unchanged, the new Y can be calculated from the formula `X * Y = newX * newY`. So newY is 16.675004 `(X * Y / newX = 5 * 20 / 5.997 = 16.675004)`. This means the pool will hold 16.675004 tokenB, the remaining tokenB will be sent to Tim, which means Tim will receive 3.324996 tokenB `(Y — newY = 20 – 16.675004 = 3.324996)`. After the swap, the pool has 6 tokenA and 16.675004 tokenB

#### Math

-   [Math behind Uniswap — swap ( part2 )](https://medium.com/@jarekcoding/math-behind-uniswap-swap-part2-d51d6a37ce89)
-   [A Mathematical View of Automated Market Maker (AMM) Algorithms and Its Future](https://medium.com/anchordao-lab/automated-market-maker-amm-algorithms-and-its-future-f2d5e6cc624a)
-   [Constant Sum AMM Math | DeFi](https://www.youtube.com/watch?v=-JhgcqvyYeM)
-   [Constant Sum Automated Market Maker | Solidity 0.8](https://www.youtube.com/watch?v=Luff_OGvYtI)
