// SPDX-License-Identifier: MIT
pragma solidity ^0.8.9;

import "@openzeppelin/contracts-upgradeable/token/ERC721/ERC721Upgradeable.sol";
import "@openzeppelin/contracts-upgradeable/token/ERC721/extensions/ERC721BurnableUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/access/AccessControlUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/proxy/utils/Initializable.sol";
import "@openzeppelin/contracts-upgradeable/utils/CountersUpgradeable.sol";
import {ERC2771ContextUpgradeable} from "@openzeppelin/contracts-upgradeable/metatx/ERC2771ContextUpgradeable.sol";
import '@openzeppelin/contracts/utils/Strings.sol';
import { IERC20 } from '@openzeppelin/contracts/token/ERC20/IERC20.sol';
import { SafeERC20 } from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";


contract AIrtNFT is Initializable, ERC721Upgradeable, ERC721BurnableUpgradeable, AccessControlUpgradeable, ERC2771ContextUpgradeable {
    using CountersUpgradeable for CountersUpgradeable.Counter;
    using SafeERC20 for IERC20;

    bytes32 public constant MINTER_ROLE = keccak256("MINTER_ROLE");
    CountersUpgradeable.Counter private _tokenIdCounter;

    /// @custom:oz-upgrades-unsafe-allow constructor
    constructor() ERC2771ContextUpgradeable(0xBf175FCC7086b4f9bd59d5EAE8eA67b8f940DE0d) {
       // _disableInitializers();
    }

    function initialize() initializer public {
        __ERC721_init("AIrt NFT", "ART");
        __ERC721Burnable_init();
        __AccessControl_init();

        _grantRole(DEFAULT_ADMIN_ROLE, msg.sender);
        _grantRole(MINTER_ROLE, msg.sender);
    }

    function _baseURI() internal view override returns (string memory) {
        return string(abi.encodePacked('https://api.airtist.xyz/meta/', Strings.toHexString(uint160(address(this)), 20), '/'));
    }

    function safeMint(address to, uint256 amount, address currency) public onlyRole(MINTER_ROLE) {
        if ( (amount > 0) && ( currency != address(0) ) ) {
            IERC20 token = IERC20(currency);
            token.safeTransferFrom(to, _msgSender(), amount);  // TODO: change fee recipient for production
        }
        uint256 tokenId = _tokenIdCounter.current();
        _tokenIdCounter.increment();
        _safeMint(to, tokenId);
    }

    // The following functions are overrides required by Solidity.

    function supportsInterface(bytes4 interfaceId)
        public
        view
        override(ERC721Upgradeable, AccessControlUpgradeable)
        returns (bool)
    {
        return super.supportsInterface(interfaceId);
    }

    function _msgSender() internal view override(ERC2771ContextUpgradeable, ContextUpgradeable) returns (address) {
        return super._msgSender();
    }

    function _msgData() internal view override(ERC2771ContextUpgradeable, ContextUpgradeable) returns (bytes calldata) {
        return super._msgData();
    }
}
