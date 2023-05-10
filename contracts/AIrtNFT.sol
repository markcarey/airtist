// SPDX-License-Identifier: MIT
pragma solidity ^0.8.9;

import "@openzeppelin/contracts-upgradeable/token/ERC721/ERC721Upgradeable.sol";
import "@openzeppelin/contracts-upgradeable/token/ERC721/extensions/ERC721BurnableUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/access/AccessControlUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/access/OwnableUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/proxy/utils/Initializable.sol";
import "@openzeppelin/contracts-upgradeable/utils/CountersUpgradeable.sol";
import {ERC2771ContextUpgradeable} from "@openzeppelin/contracts-upgradeable/metatx/ERC2771ContextUpgradeable.sol";
import '@openzeppelin/contracts/utils/Strings.sol';
import { IERC20 } from '@openzeppelin/contracts/token/ERC20/IERC20.sol';
import { SafeERC20 } from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";


contract AIrtNFT is Initializable, ERC721Upgradeable, ERC721BurnableUpgradeable, AccessControlUpgradeable, OwnableUpgradeable, ERC2771ContextUpgradeable {
    using CountersUpgradeable for CountersUpgradeable.Counter;
    using SafeERC20 for IERC20;

    bytes32 public constant MINTER_ROLE = keccak256("MINTER_ROLE");
    bytes32 public constant TRANSPORTER_ROLE = keccak256("TRANSPORTER_ROLE");
    CountersUpgradeable.Counter private _tokenIdCounter;
    IERC20 public pAInt;

    /// @custom:oz-upgrades-unsafe-allow constructor
    constructor() ERC2771ContextUpgradeable(0xBf175FCC7086b4f9bd59d5EAE8eA67b8f940DE0d) {
       _disableInitializers();
    }

    function initialize(string calldata _name, string calldata _symbol, address _admin, address _owner) initializer public {
        __ERC721_init(_name, _symbol);
        __ERC721Burnable_init();
        __AccessControl_init();
        pAInt = IERC20(0xB66cf6eAf3A2f7c348e91bf1504d37a834aBEB8A);
        _grantRole(DEFAULT_ADMIN_ROLE, _admin);
        _grantRole(MINTER_ROLE, _admin);
        _grantRole(TRANSPORTER_ROLE, _admin);
        _transferOwnership(_owner);
    }

    function _baseURI() internal view override returns (string memory) {
        return string(abi.encodePacked('https://api.airtist.xyz/meta/', Strings.toHexString(uint160(address(this)), 20), '/'));
    }

    function publicMint(address creator, address to, uint256 amount, address currency) public onlyRole(MINTER_ROLE) {
        if ( (amount > 0) && ( currency != address(0) ) ) {
            IERC20 token = IERC20(currency);
            token.safeTransferFrom(to, creator, amount);  // TODO: charge protocol fee?
        }
        _artMint(to);
    }

    function selfMint(address to) public onlyRole(MINTER_ROLE) {
        pAInt.safeTransferFrom(to, _msgSender(), 1e18);
        _artMint(to);
    }

    function depart(uint256 tokenId) public onlyRole(TRANSPORTER_ROLE) {
        _burn(tokenId);
    }

    function arrive(address to, uint256 tokenId) public onlyRole(TRANSPORTER_ROLE) {
        require(_exists(tokenId) == false, "!already exists");
        _safeMint(to, tokenId);
    }

    function _artMint(address to) internal {
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
