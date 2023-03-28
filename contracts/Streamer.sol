// SPDX-License-Identifier: MIT
pragma solidity ^0.8.2;

import { ISuperfluid, ISuperToken, ISuperAgreement } from "@superfluid-finance/ethereum-contracts/contracts/interfaces/superfluid/ISuperfluid.sol";
import { IConstantFlowAgreementV1 } from "@superfluid-finance/ethereum-contracts/contracts/interfaces/agreements/IConstantFlowAgreementV1.sol";
import { ISuperTokenFactory } from "@superfluid-finance/ethereum-contracts/contracts/interfaces/superfluid/ISuperTokenFactory.sol";
import { INativeSuperToken } from "./superfluid-finance/ethereum-contracts/contracts/interfaces/tokens/INativeSuperToken.sol"; 
import { NativeSuperTokenProxy } from "./superfluid-finance/ethereum-contracts/contracts/tokens/NativeSuperToken.sol";
import { CFAv1Library } from "./superfluid-finance/ethereum-contracts/contracts/apps/CFAv1Library.sol";
import {ERC2771Context} from "@openzeppelin/contracts/metatx/ERC2771Context.sol";
import "@openzeppelin/contracts/utils/math/SafeMath.sol";
import "@openzeppelin/contracts/access/AccessControl.sol";

contract Streamer is AccessControl, ERC2771Context {
    using SafeMath for uint256;
    using CFAv1Library for CFAv1Library.InitData;

    ISuperTokenFactory private _superTokenFactory;
    INativeSuperToken public token;
    ISuperfluid _host;
    IConstantFlowAgreementV1 _cfa;
    CFAv1Library.InitData public cfaV1;

    bytes32 public constant STREAM_MANAGER_ROLE = keccak256("STREAM_MANAGER_ROLE");

    constructor(string memory name, string memory symbol, uint256 supply, address _stf, address host, address cfa) 
        ERC2771Context(0xBf175FCC7086b4f9bd59d5EAE8eA67b8f940DE0d) {
        token = INativeSuperToken(address(new NativeSuperTokenProxy()));
        _superTokenFactory = ISuperTokenFactory(_stf);
        _superTokenFactory.initializeCustomSuperToken(address(token));
        token.initialize(name, symbol, supply, address(this));
        _host = ISuperfluid(host);
        _cfa = IConstantFlowAgreementV1(cfa);
        cfaV1 = CFAv1Library.InitData(_host, IConstantFlowAgreementV1(address(_host.getAgreementClass(keccak256("org.superfluid-finance.agreements.ConstantFlowAgreement.v1")))));
        _grantRole(DEFAULT_ADMIN_ROLE, msg.sender);
        _grantRole(STREAM_MANAGER_ROLE, msg.sender);
    }

    function stream(address to, int96 flowRate, uint256 amount) external onlyRole(STREAM_MANAGER_ROLE) {
        if (amount > 0) {
            token.transfer(to, amount);
        }
        cfaV1.flow(to, token, flowRate);
    }

     function _msgSender() internal view override(ERC2771Context, Context) returns (address) {
        return super._msgSender();
    }

    function _msgData() internal view override(ERC2771Context, Context) returns (bytes calldata) {
        return super._msgData();
    }

}
