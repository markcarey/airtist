# AIrtist

## A platform for creating, sharing, and minting AI art

AIrtist is like Instagram for AI art: instead of uploading photos, users enter text prompts used by AI to generate the images. Features include both "web 2.0" style social features like commenting, liking, and reposting, as well as (optional) web3 features like minting images as NFTs on the blockchain.

AIrtist uses "account abstraction" to make it seamless for users, without needing wallets nor gas tokens to get started. Even when minting NFTs, users never have to "send transactions", "sign messages", nor write down 12- or 24-word phrases on pieces of paper.

## Quick Links

 - Try it now: https://airtist.xyz (minting on Goerli testnet)
 - [Slide Presentation](https://docs.google.com/presentation/d/e/2PACX-1vQHk0hUKl1FHKscabCKa432GbYgqxaspEWeJ9n59cy_OqILc22yfVD6RY0WPrSPljkC4KtRxdwnlK_x/pub?start=false&loop=false&delayms=3000)
 - Demo Video: https://youtu.be/HlvKtf1z-AM

## Sign and Login

Using web3Auth, AIrtist login options include social, email, or wallet. Social/email logins will generate an app-specific private key … behind the scenes, no seed phrase needed – only the user has access to the [complete private key](https://web3auth.io/docs/infrastructure/key-management) (self-custody), enabled by Multi-Paty Computation (MPC).

Social login users:
- do not need a wallet
- do not see an EVM address
- are not asked to “sign” any messages
- do not need ETH or any other token for “gas”

## Web 2.0 Features

Several "web 2.0" styles features include:
- *Creating and sharing AI images.* User enter text prompts to share AI-generated art. (powered by DALL-E from OpenAI)
- *Liking.* Users can "like" images shared by others
- *Commenting.* User can post comments in reply to shared images
- *Reposting.* This is a bit like _retweeting_, but with a twist. A `repost` does *not* re-share the same identical image, but rather uses the same identical text prompt to generate an entirely *new* image.
- *Following.* Users can follow other users to if they like their artwork.

## Web3 Features

Some users may optionally decide to mint images as NFTs on the blockchain. When users post new artwork, they can:
1. Choose to immediately mint the image on the blockchain.
2. Enable others to mint the image for a price.
3. Neither (image will not be minted)
Creators can always decide later -- after posting -- to mint their own images.

Minting during art creation is done by toggling a checkbox. For image already posted, minting involves a single click/tap. In both cases, the user does not have to send transactions nor sign messages.

### The pAInt Super Token

When minting your own artwork, it costs `1 pAInt` token. When minting images posted by others, you pay the price set by the creator, denominated in either `pAInt` or `WETH`.

`pAInt` is a native Super Token that supports real-time streaming, powered by Superfluid. It acts as a utility token on the AIrtist platform for minting NFTs. Users start with `5 pAInt` and after their first mint, active users receive `3 pAInt` per month, streamed in real-time.

See the streams on [Superfluid Console](https://console.superfluid.finance/goerli/accounts/0x83D4A49b80Af1CE060361A457a02d057560A9aD9?tab=streams). It's like watching paint stream.😐

### The First Mint - Behind the Scenes

When the user decides to mint their first NFT -- and not before -- on-chain transactions are triggered, behind the scenes:
1. *A Safe smart wallet is deployed.* This is a “1 of 3” multi-signature Safe. The user’s web3auth-generated address has full access as 1 of the 3 owners. The second owner is a AIrtist Hot wallet enabling behind-the-scenes Safe transactions on the behalf of the user. The third owner is a AIrtist cold wallet for emergency/recovery purposes.
2. ERC20 Approval transactions are sent from the Safe to facilitate the first and future mints.
3. Sent via Gelato Relay, a transaction is sent to start streaming `3 pAInt` per month to the Safe.
4. Also via Gelato Relay, the minting transaction is sent to mint the NFT to the shared AIrtist NFT contract.
Remember, the above 4 transaction happen *behind the scenes*. _From the user's perspective all they did was check a box or tap a link_.

#### Gelato Relay Sponsored ERC2771 Calls

AIrtist uses [Gelato Relay](https://docs.gelato.network/developer-services/relay) to send tokens and NFTs to users' Safes (and one more action discussed below). These requests are signed and submitted on-chain by Gelato relayers, with gas paid from AIrtist's [Gelato 1 Balance](https://docs.gelato.network/developer-services/relay/payment-and-fees#1balance) account. Each of the three contracts deployed by AIrtist support [ERC2771 Context](https://docs.gelato.network/developer-services/relay/quick-start/erc-2771) which enables secure transactions to be signed by AIrtist but realyed onchain by Gelato Relayers. This works seamlessly with OpenZeppelin's `AccessControl` permission to restrict function to authorized signers.

### Subsequent NFT Minting

Subsequent NFT minting triggers a single transaction -- via Gelato Relay -- to mint the NFT to their Safe, while withdrawing `1 pAInt` from the Safe for each NFT minted of their own art (or the required amount of `pAInt` or `WETH` if minting others’ art). If a user has less than `1 pAInt` they cannot mint and must wait until they accumulate enough via the incoming stream (or by other means 🦄)

#### Selling NFTs without a Deployed Safe to receive Payment?

*Scenario:* a creator has joined AIrtist and posted several images, but has not minted any yet. But the creator has enabled minting of the posts, and set prices and currencies (`pAInt` or `WETH`) in each case. What happens when another user decides to mint these images? How does the creator get paid, when no Safe has (yet) be deployed for the creator? As mentioned above, the Safe is only deployed when the user does their first mint, and not before. Even though the Safe has not been deployed, the creator still gets paid! When the creator joined AIrtist, the Safe SDK is used to accurately _predict_ the user's Safe address, _even though it has not yet been deployed_. This predicted Safe address is assigned to creator's user account, and when `pAInt` or `WETH` gets sent to that address, it just works, and the funds are [owned by the predicted Safe address](https://blog.openzeppelin.com/getting-the-most-out-of-create2/). When/if the creator triggers their first mint, the Safe will then be deployed to the predicted address and the creator will have full access to the tokens sent previously.

## AIrtist PRO

Since we are sponsoring -- paying for gas -- users' transactions, using `pAInt` as a utility token helps limit the ghas costs associated with users on the FREE plan. These user receive `3 pAInt` monthly, streamed in real-time.

For serious AIrtists, minting 3 NFTs per month may not be enough.

AIrtist uses a _freemium_ business model, where cloud-computing and gas costs are subsidized (sponsored) for FREE users, while revenue from PRO users more than offsets those costs.

AIrtist PRO is a monthly subscription powered by Stripe Billing. Consistent with the goal of account abstraction, PRO users pay via credit card recurring billing (with future plans to add support for crypto-native billing options).

### AIrtist PRO Features

- a dedicated NFT contract for each PRO user (deployed from the AIrtist Factory contract via Gelato Relay)
- increased stream, now `30 pAInt` streamed monthly in real-time
- preview before posting: view multiple images based on your text prompt, then choose the best to post (coming soon)
- option to keep prompts private from other users (coming soon)
- more to come

### Stripe Webhooks

When a user buys a PRO subscription, an event is sent from Stripe to a webhook endpoint on the AIrtist API. This triggers the 2 transactions (via Gelato Relay) to deploy an NFT contract for the user and to increase the stream to `30 pAInt` per month. Additionally, as an "upgrade bonus", `10 pAInt` are airdropped to the PRO user's Safe at the time of the upgrade. From this point forward, the user's image are minted to their own contract/collection, which contains only their own artwork.

When a PRO subscription is cancelled, another event webhook automatically triggers a transaction to reduce the stream back to `3 pAInt` per month and flip the user back to minting on the shared NFT contract.

