import { ethers } from 'hardhat'
import chai from 'chai'
import { TipRelayTester, TipRelayTester__factory, TipRelayer, TipRelayer__factory} from '../typechain'
import signWhitelist from '../util/signWhitelist'
import { SignerWithAddress } from '@nomiclabs/hardhat-ethers/signers'
import { solidity } from 'ethereum-waffle'
import { BaseProvider } from "@ethersproject/providers";

chai.use(solidity)
const { expect } = chai

describe('Relay', function () {
    let accounts: SignerWithAddress[]

    let relayer: TipRelayer
    let relayerFactory: TipRelayer__factory

    let relayTester: TipRelayTester
    let relayTesterFactory: TipRelayTester__factory
    let provider: BaseProvider;

    let chainId: number

    this.beforeAll(async function () {
        provider = ethers.provider;
        accounts = await ethers.getSigners()
        const network = await ethers.provider.getNetwork()
        chainId = network.chainId
        relayerFactory = (await ethers.getContractFactory('TipRelayer', accounts[0])) as TipRelayer__factory
        relayTesterFactory = (await ethers.getContractFactory('TipRelayTester', accounts[0])) as TipRelayTester__factory
    })

    beforeEach(async function () {
        relayer = await relayerFactory.deploy(
        )
        relayTester = await relayTesterFactory.deploy(relayer.address)
    })

    describe('relays', function () {
      
        it('Sends funds to msg sender when invoked directly', async function () {
          const balanceBefore = await provider.getBalance(accounts[0].address)
            await accounts[0].sendTransaction({to: relayer.address, value: ethers.utils.parseEther("10") })
          const balanceAfter = await provider.getBalance(accounts[0].address)
          console.log({balanceBefore, balanceAfter, diff: balanceBefore.sub(balanceAfter)})
          expect(balanceBefore.sub(balanceAfter).lt(ethers.utils.parseEther('1'))).to.be.true
        })
        it('Sends funds to msg sender when invoked indirectly', async function () {
          const balanceBefore = await provider.getBalance(accounts[0].address)
            await accounts[0].sendTransaction({to: relayTester.address, value: ethers.utils.parseEther("10") })
            await relayTester.distribute()
          const balanceAfter = await provider.getBalance(accounts[0].address)
          expect(balanceBefore.sub(balanceAfter).lt(ethers.utils.parseEther('1'))).to.be.true
        })
    })


    // Supports interface
})
