---
title: "Optimism - Optimistic"
---

-   [Optimistic Bridges](https://blog.connext.network/optimistic-bridges-fb800dc7b0e0)
-   [Everything You Need to Know About Optimism](https://blog.perp.fi/everything-you-need-to-know-about-optimism-86477fd104c5)
-   [Exploring Optimism: What Is It and How Can It Benefit Ethereum Layer 2?](https://blazingburgundy.medium.com/exploring-optimism-what-is-it-and-how-can-it-benefit-ethereum-layer-2-ad9f8655ba7e)

### High-level urls

-   medium.com/plasma-group
-   medium.com/ethereum-optimism
-   community.optimism.io
-   github.com/ethereum-optimism

### Commentary

-   https://hackmd.io/O0qg4SuyT3S5PAbJZKwEuw#L2-Future---Session-3

### How it works

-   https://youtu.be/cNyB-MJdI20?t=15611 (Stanford BlockChain - Day 3)
-   https://docs.ethhub.io/ethereum-roadmap/layer-2-scaling/optimistic\_rollups/
-   https://medium.com/plasma-group/ethereum-smart-contracts-in-l2-optimistic-rollup-2c1cef2ec537
-   https://medium.com/ethereum-optimism/ovm-deep-dive-a300d1085f52
-   http://community.optimism.io/docs/protocol/protocol.html (~https://docs.optimism.io/protocol-specifications/optimistic-rollup/block-production~)
-   https://hackmd.io/Inuu-T\_UTsSXnzGtrLR8gA#OVMEVM-differences
-   https://gist.github.com/maurelian/7ae127f3c838feeebfe9f77e1928f3ff (L2 to L1 flow)

### Dev

-   http://community.optimism.io/docs/ (~docs.optimism.io (/tutorial and /docs)~)
-   https://github.com/ethereum-optimism/optimism-integration

#### Specific

-   https://github.com/ethereum-optimism/contracts-v2/blob/master/contracts/optimistic-ethereum/OVM/accounts/OVM\_ECDSAContractAccount.sol
-   https://github.com/ethereum-optimism/contracts-v2/blob/master/contracts/optimistic-ethereum/OVM/chain/OVM\_CanonicalTransactionChain.sol (L2 txs on L1)
-   ~https://github.com/ethereum-optimism/integration-tests/blob/8baad44b9cd9081a4d399a6010affc54db218443/packages/tx-ingestion/test/sequencer-batch-append.spec.ts#L30 (test with L2 provider)~ NB: no need to use @eth-optimism/provider
-   https://discord.com/channels/667044843901681675/667044844366987296/796288770612658176 (View sequencer txs)
-   https://discord.com/channels/667044843901681675/667044844366987296/796492025922715678 (Optimism mainnet)
-   https://www.twitch.tv/videos/863816992 (Optimism live-coding L1-L2 bridged calls)

## Optimism Smart Contract Development

-   [❓ Developing smart contracts on Optimism](https://community.optimism.io/docs/guides/smart-contract-devs/#local-development)
-   [❓ Porting Solidity Contracts to Optimism: A Guide Using Uniswap V2](https://hackmd.io/@scopelift/Hy853dTsP)
-   [❓ Deploy Smart Contract to Optimism | Layer 2](https://www.youtube.com/watch?v=aYXhUJB6w-k&ab_channel=SmartContractProgrammer)
-   [❓ How to create an ERC721 NFT Smart Contract on Optimism](https://www.youtube.com/watch?v=-kcrQKA-ZLk&ab_channel=Ankr)
-   [❓ Justin Moses: Tips and Tricks to Deploy L1 Smart Contracts on Optimism](https://www.youtube.com/watch?v=cAxQJS7YZPY&ab_channel=Chainlink)
-   [❓ t4sk/hello-l2](https://github.com/t4sk/hello-l2)
-   [❓ Optimism Kovan Faucet](https://optimismfaucet.xyz/)
-   [❓ Etherscan | Kovan Optimistic](https://kovan-optimistic.etherscan.io/)
-   [❓ Networks and Public RPC Endpoints](https://community.optimism.io/docs/useful-tools/networks/#)

## Smock

-   [The Highly Optimistic Dev Blog #03: Introducing Smock v2](https://medium.com/ethereum-optimism/the-highly-optimistic-dev-blog-03-introducing-smock-v2-d252441994a8)
