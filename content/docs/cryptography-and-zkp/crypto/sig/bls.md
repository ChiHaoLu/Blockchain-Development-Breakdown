---
title: "BLS sigs"
---

-   [BLS Signatures & Withdrawals](https://medium.com/nethermind-eth/bls-signatures-withdrawals-bbf38658c242)
-   [BLS Wallet: Bundling up data](https://medium.com/privacy-scaling-explorations/bls-wallet-bundling-up-data-fb5424d3bdd3)
-   [BLS Signatures Part 2 — Key Concepts of Pairings](https://alonmuroch-65570.medium.com/bls-signatures-part-2-key-concepts-of-pairings-27a8a9533d0c)
-   [BLS signatures: better than Schnorr](https://medium.com/cryptoadvance/bls-signatures-better-than-schnorr-5a7fe30ea716)
-   [BLS Signatures in Solidity](https://hackmd.io/@liangcc/bls-solidity)
-   [Explaining BLS12–381 … The “Zero Knowledge Proof” Curve](https://medium.com/asecuritysite-when-bob-met-alice/explaining-bls12-381-the-zero-knowledge-proof-curve-aa5eabec8261)
-   [ERC20 transfer process data compression path analysis](https://orbiter-finance.medium.com/erc20-transfer-process-data-compression-path-analysis-b58f35ee78c9)
-   [Learning the principles of the BLS signature algorithm](https://orbiter-finance.medium.com/learning-the-principles-of-the-bls-signature-algorithm-8d93dfa30d6f)

(1) BLS 12-381 的 IETF spec 仍是草稿，Ethereum 目前用 draft-04，不過 draft-05 已經出爐

(2) Beacon chain 目前有用到 BLS 是在 validator signature 和 randao\_reveal (之後會投稿一篇 post-Merge 的輕鬆看 Etherscan)

(3) BLS 12-381 (IETF ver) 只提供幾種 core operation CoreSign()、CoreVerify()、CoreAggregateVerify() 換句話說沒有 recover PubKey

(4) compressed form 長度 Public key (∈G1)：48B = 96 hex digits = 384 bits Signature (∈G2)：96B = 192 hex digits = 768 bits ↑推薦大家用 Infura 或自架節點體驗一下 (貌似 Alchemy 還沒有🤔)

(5) 雖然看起來很多有的沒的參數，但其實 BLS12-381 可以把全部東西都化作同一個數值 t 的多項式 t = -0xd201000000010000 (它是負數，怪美的吧🤩)

(5) 大推 Craig Costello, "Pairings for beginners"，網路上找得到 PDF，附件是我自己的加註解版本 (可能會有用語不精確)

(6) Pairing 很貴，即使 BLS 和 BN 是基於 optimal ate pairing，仍然沒辦法跟 ECDSA 匹敵，障礙在 Miller's loop 和 final exponentiation，因此 pairing based protocol 一般會想辦法只做一次 pairing；另外，加速 final exponentiation 的專利剛好在 2020 年過期，跟 Schnorr 一樣來得很是時候

(7) 今天提到很多為加速做的額外數學結構，事實上那些都可能弱化 pairing based curve (存在 attack 論文)，所以也有人認為不應該讓 BLS/BN curve 太快取代 ECDSA、EdDSA、Ed25519 等"香草" ECC

(8) Schnorr 也可以做到 signature 聚合，但它是基於"香草" EC 曲線；它跟 pairing based curve 的差別是在亂數器和聚合的程度，這部分有機會下次再速速帶過

(9) 今天提到那個點加法的實例，我會再更新過程進去筆記裡面 (Fkr8Q 結尾那份)

(10) verifier 在 Groth16 要做三次 pairing，PLONK 則是兩次，總之 pairing 是一個逃不掉的必學技巧ㄌ 😭😢

Useful links： https://andrea.corbellini.name/ecc/interactive/modk-add.html https://medium.com/cryptoadvance/5a7fe30ea716 https://medium.com/cryptoadvance/91655bcb4744 https://hackmd.io/X9XfNdPYRZG92\_JsqFkr8Q https://hackmd.io/oFmZZHamQUOKG9DHhEV7lw https://datatracker.ietf.org/doc/html/draft-irtf-cfrg-bls-signature-04 https://datatracker.ietf.org/doc/html/draft-irtf-cfrg-pairing-friendly-curves-10#section-4.2.1 https://electriccoin.co/blog/new-snark-curve/

## BN

-   [And So Satoshi Selected secp256k1 for Bitcoin, But There Are Better Curves for Smart Contracts](https://medium.com/asecuritysite-when-bob-met-alice/and-so-satoshi-selected-secp256k1-for-bitcoin-but-there-are-better-curves-for-smart-contracts-dfe16ff7a96f)
