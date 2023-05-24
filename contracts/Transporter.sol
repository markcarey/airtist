// SPDX-License-Identifier: MIT
pragma solidity ^0.8.9;

import { IAxelarGasService } from '@axelar-network/axelar-gmp-sdk-solidity/contracts/interfaces/IAxelarGasService.sol';
import { IAxelarGateway } from '@axelar-network/axelar-gmp-sdk-solidity/contracts/interfaces/IAxelarGateway.sol';
import { IAxelarExecutable } from '@axelar-network/axelar-gmp-sdk-solidity/contracts/interfaces/IAxelarExecutable.sol';
import { AddressToString, StringToAddress } from '@axelar-network/axelar-gmp-sdk-solidity/contracts/utils/AddressString.sol';
import {ERC2771ContextUpgradeable} from "@openzeppelin/contracts-upgradeable/metatx/ERC2771ContextUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/access/AccessControlUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/proxy/utils/Initializable.sol";

interface IERC721Transportable {
    function depart(uint256 tokenId) external;
    function arrive(address to, uint256 tokenId) external;
}

contract Transporter is Initializable, IAxelarExecutable, AccessControlUpgradeable, ERC2771ContextUpgradeable  {
    using StringToAddress for string;
    using AddressToString for address;
   
    IAxelarGateway public gateway;
    IAxelarGasService public gasReceiver;
    bytes32 public constant TRANSPORTER_ROLE = keccak256("TRANSPORTER_ROLE");

    /// @custom:oz-upgrades-unsafe-allow constructor
    constructor() ERC2771ContextUpgradeable(0xBf175FCC7086b4f9bd59d5EAE8eA67b8f940DE0d) {
       _disableInitializers();
    }

    function initialize(address gateway_, address gasReceiver_, address _admin) public virtual initializer {
        gateway = IAxelarGateway(gateway_);
        gasReceiver = IAxelarGasService(gasReceiver_);
        _grantRole(TRANSPORTER_ROLE, _admin);
        _grantRole(TRANSPORTER_ROLE, address(this));
    }

    function send(address nftAddress, address to, uint256 tokenId, string memory chainName, uint256 fee) external payable onlyRole(TRANSPORTER_ROLE) {
        IERC721Transportable(nftAddress).depart(tokenId);
        bytes memory payload = abi.encode(nftAddress, to, tokenId);
        gasReceiver.payNativeGasForContractCall{ value: fee }(
            address(this),
            chainName,
            address(this).toString(),  // assumes CREATE2 deployment with same address on all chains
            payload,
            _msgSender()
        );
        gateway.callContract(chainName, address(this).toString(), payload);
    }

    // receive
    function execute(
        bytes32 commandId,
        string calldata sourceChain,
        string calldata sourceAddress,
        bytes calldata payload
    ) external {
        bytes32 payloadHash = keccak256(payload);

        if (!gateway.validateContractCall(commandId, sourceChain, sourceAddress, payloadHash))
            revert NotApprovedByGateway();

        _execute(sourceChain, sourceAddress, payload);
    }

    function executeWithToken(
        bytes32 commandId,
        string calldata sourceChain,
        string calldata sourceAddress,
        bytes calldata payload,
        string calldata tokenSymbol,
        uint256 amount
    ) external {
        bytes32 payloadHash = keccak256(payload);

        if (
            !gateway.validateContractCallAndMint(
                commandId,
                sourceChain,
                sourceAddress,
                payloadHash,
                tokenSymbol,
                amount
            )
        ) revert NotApprovedByGateway();

        _executeWithToken(sourceChain, sourceAddress, payload, tokenSymbol, amount);
    }

    function _executeWithToken(
        string calldata sourceChain,
        string calldata sourceAddress,
        bytes calldata payload,
        string calldata tokenSymbol,
        uint256 amount
    ) internal virtual {}

    function _execute(string memory, string memory sourceAddress, bytes calldata payload) internal virtual {
        require( hasRole(TRANSPORTER_ROLE, sourceAddress.toAddress()), "!untrusted source" );
        (address nftAddress, address to, uint256 tokenId) = abi.decode(payload, (address, address, uint256));
        IERC721Transportable(nftAddress).arrive(to, tokenId);
    }

    function withdraw() external onlyRole(TRANSPORTER_ROLE) {
        payable(_msgSender()).transfer(address(this).balance);
    }

    receive() external payable {}

    // The following functions are overrides required by Solidity.

    function _msgSender() internal view override(ERC2771ContextUpgradeable, ContextUpgradeable) returns (address) {
        return super._msgSender();
    }

    function _msgData() internal view override(ERC2771ContextUpgradeable, ContextUpgradeable) returns (bytes calldata) {
        return super._msgData();
    }

}
