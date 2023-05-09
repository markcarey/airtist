// SPDX-License-Identifier: MIT
pragma solidity ^0.8.9;

import { IAxelarGasService } from '@axelar-network/axelar-gmp-sdk-solidity/contracts/interfaces/IAxelarGasService.sol';
import { IAxelarGateway } from '@axelar-network/axelar-gmp-sdk-solidity/contracts/interfaces/IAxelarGateway.sol';
import { IAxelarExecutable } from '@axelar-network/axelar-gmp-sdk-solidity/contracts/interfaces/IAxelarExecutable.sol';
import { AddressToString, StringToAddress } from '@axelar-network/axelar-gmp-sdk-solidity/contracts/utils/AddressString.sol';
import "@openzeppelin/contracts/proxy/utils/Initializable.sol";

interface IERC721Transportable {
    function depart(uint256 tokenId) external;
    function arrive(address to, uint256 tokenId) external;
}

contract Transporter is Initializable, IAxelarExecutable  {
    using StringToAddress for string;
    using AddressToString for address;

   // event TransportStarted();
   
    IAxelarGateway public gateway;
    IAxelarGasService public gasReceiver;

    function initialize(address gateway_, address gasReceiver_) public virtual initializer {
        gateway = IAxelarGateway(gateway_);
        gasReceiver = IAxelarGasService(gasReceiver_);
    }

    function depart(address nftAddress, address to, uint256 tokenId, string memory chainName, uint256 fee) external {
        // TODO: permissions + other checks
        IERC721Transportable(nftAddress).depart(tokenId);
        bytes memory payload = abi.encode(nftAddress, to, tokenId);
        gasReceiver.payNativeGasForContractCall{ value: fee }(
            address(this),
            chainName,
            address(this).toString(),  // assumes CREATE2 deployment with same address on all chains
            payload,
            msg.sender // TODO: change to _msgSender() and setup ERC2771ContextUpgradeable?
        );
        gateway.callContract(chainName, address(this).toString(), payload);
    }

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

    function _execute(string memory sourceChain, string memory sourceAddress, bytes calldata payload) internal virtual {
        (address nftAddress, address to, uint256 tokenId) = abi.decode(payload, (address, address, uint256));
        IERC721Transportable(nftAddress).arrive(to, tokenId);
    }

}
