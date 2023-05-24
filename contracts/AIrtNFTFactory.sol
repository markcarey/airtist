// SPDX-License-Identifier: MIT
pragma solidity ^0.8.9;

import {ERC2771Context} from "@openzeppelin/contracts/metatx/ERC2771Context.sol";
import "@openzeppelin/contracts-upgradeable/proxy/utils/Initializable.sol";
import "@openzeppelin/contracts/proxy/Clones.sol";

interface IAIrtNFT {
    function initialize(string calldata _name, string calldata _symbol, address _admin, address _owner) external;
}
interface ITransporter {
    function initialize(address gateway_, address gasReceiver_, address _admin) external;
}

contract AIrtNFTFactory is Initializable, ERC2771Context {
    address public nftImplementation;
    address public transporterImplementation;

    constructor() ERC2771Context(0xBf175FCC7086b4f9bd59d5EAE8eA67b8f940DE0d) {
        //_disableInitializers();
    }

    function initialize(address _nftImplementation, address _transporterImplementation) initializer public {
        nftImplementation = _nftImplementation;
        transporterImplementation = _transporterImplementation;
    }

    event AIrtNFTCreated(
        address indexed owner,
        address nftContract
    );

    event TransporterCreated(
        address indexed creator,
        address transporterContract
    );

    // @dev deploys a AIrtNFT contract
    function createAIrtNFT(string calldata _name, string calldata _symbol, address owner) external returns (address) {
        bytes32 salt = keccak256(abi.encode(_name, _symbol, owner));
        address clone = Clones.cloneDeterministic(nftImplementation, salt);
        IAIrtNFT(clone).initialize(_name, _symbol, _msgSender(), owner);
        emit AIrtNFTCreated(_msgSender(), clone);
        return clone;
    }

    // @dev deploys a Transporter contract
    function createTransporter(address gateway_, address gasReceiver_, string calldata _salt) external returns (address) {
        bytes32 salt = keccak256(abi.encode(_salt));
        address clone = Clones.cloneDeterministic(transporterImplementation, salt);
        ITransporter(clone).initialize(gateway_, gasReceiver_, _msgSender());
        emit TransporterCreated(_msgSender(), clone);
        return clone;
    }

}
