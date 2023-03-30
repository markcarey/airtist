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


