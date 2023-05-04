// SPDX-License-Identifier: MIT
pragma solidity ^0.8.9;

import { IAxelarGasService } from '@axelar-network/axelar-gmp-sdk-solidity/contracts/interfaces/IAxelarGasService.sol';
import { IAxelarGateway } from '@axelar-network/axelar-gmp-sdk-solidity/contracts/interfaces/IAxelarGateway.sol';
import { IAxelarExecutable } from '@axelar-network/axelar-gmp-sdk-solidity/contracts/interfaces/IAxelarExecutable.sol';
import { AddressToString, StringToAddress } from '@axelar-network/axelar-gmp-sdk-solidity/contracts/utils/AddressString.sol';
import "@openzeppelin/contracts/proxy/utils/Initializable.sol";

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

}
