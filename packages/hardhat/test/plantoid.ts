import { ethers } from 'hardhat'
import { solidity } from 'ethereum-waffle'
import { use, expect } from 'chai'
import { SignerWithAddress } from '@nomiclabs/hardhat-ethers/signers'

import { Plantoid } from '../typechain/Plantoid'
import { PlantoidSpawn } from '../typechain/PlantoidSpawn'
import { Wallet } from '@ethersproject/wallet'
import { ContractFactory, ContractTransaction } from '@ethersproject/contracts'
import { BaseProvider } from '@ethersproject/providers'

use(solidity)

// chai
//   .use(require('chai-as-promised'))
//   .should();

async function blockTime() {
    const block = await ethers.provider.getBlock('latest')
    return block.timestamp
}

const errorMessages = {
    belowThreshold: 'ThresholdNotReached()',
    notInVoting: 'NotInVoting()',
    alreadyVoted: 'AlreadyVoted()',
    notOwner: 'NotOwner()',
    invalidProposal: 'InvalidProposal()',
    vetoed: 'Vetoed()',
    notMinted: 'NotMinted()',
    alreadyRevealed: 'AlreadyRevealed()',
}

export const fastForwardTime = async (seconds: number) => {
    await ethers.provider.send('evm_increaseTime', [seconds])
    await ethers.provider.send('evm_mine', [])
}
const zeroAddress = '0x0000000000000000000000000000000000000000'

const testKey = '0xdd631135f3a99e4d747d763ab5ead2f2340a69d2a90fab05e20104731365fde3'

const getNewPlantoidAddress = async (tx: ContractTransaction): Promise<string> => {
    const receipt = await ethers.provider.getTransactionReceipt(tx.hash)
    let plantoidSummonAbi = ['event PlantoidSpawned(address indexed plantoid, address indexed artist)']
    let iface = new ethers.utils.Interface(plantoidSummonAbi)
    let log = iface.parseLog(receipt.logs[0])
    const { plantoid } = log.args
    return plantoid
}

const config = {
    depositThreshold: ethers.utils.parseEther('0.001'),
    threshold: ethers.utils.parseEther('1'),
    name: 'Plantoid',
    prereveal: 'preveal',
    symbol: 'LIFE',
    votingPeriod: 1000,
    gracePeriod: 500,
    settlePeriod: 300,
    extPeriod: 200,
}

describe('Plantoid NFT', function () {
    let plantoidInstance: Plantoid
    let plantoidSpawn: PlantoidSpawn
    let plantoidAsApplicant: Plantoid
    let plantoidAsSupporter: Plantoid

    let plantoidOracle: Wallet
    let firstCreator: SignerWithAddress
    let applicant: SignerWithAddress
    let supporter: SignerWithAddress

    let Plantoid: ContractFactory
    let PlantoidSpawn: ContractFactory

    let provider: BaseProvider
    
    let accounts: SignerWithAddress[]

    this.beforeAll(async function () {
        const adminAbstract = new ethers.Wallet(testKey)
        provider = ethers.provider
        plantoidOracle = await adminAbstract.connect(provider)
        ;[firstCreator, applicant, supporter] = await ethers.getSigners()
        accounts = await ethers.getSigners()
        Plantoid = await ethers.getContractFactory('Plantoid')
        PlantoidSpawn = await ethers.getContractFactory('PlantoidSpawn')
        const plantoidAbstract = (await Plantoid.deploy()) as Plantoid
        plantoidSpawn = (await PlantoidSpawn.deploy(plantoidAbstract.address)) as PlantoidSpawn
    })

    beforeEach(async function () {
        const tx = await plantoidSpawn.spawnPlantoid(
            plantoidOracle.address,
            firstCreator.address,
            zeroAddress,
            [config.depositThreshold,
            config.threshold],
            [config.votingPeriod, config.gracePeriod, config.settlePeriod, config.extPeriod],
            config.name,
            config.symbol,
            config.prereveal
        )
        const plantoid = await getNewPlantoidAddress(tx)
        plantoidInstance = (await Plantoid.attach(plantoid)) as Plantoid

        plantoidAsSupporter = plantoidInstance.connect(supporter)
        plantoidAsApplicant = plantoidInstance.connect(applicant)
    })

    describe('constructor', function () {
        it('verify deployment parameters', async function () {
            expect(await plantoidInstance.artist()).to.equal(firstCreator.address)
            expect(await plantoidInstance.plantoidAddress()).to.equal(plantoidOracle.address)
        })

        describe('donation', function () {
            it('Allows supporter to donate ETH', async function () {
                const balanceBefore = await provider.getBalance(plantoidInstance.address)
                await supporter.sendTransaction({ to: plantoidInstance.address, value: ethers.utils.parseEther('1') })
                const balanceAfter = await provider.getBalance(plantoidInstance.address)
                expect(balanceBefore).to.equal(0)
                expect(balanceAfter).to.equal(ethers.utils.parseEther('1'))
            })

            it('Mints an NFT on donation', async function () {
                await supporter.sendTransaction({ to: plantoidInstance.address, value: ethers.utils.parseEther('1') })
                expect(await plantoidInstance.balanceOf(supporter.address)).to.equal(1)
                expect(await plantoidInstance.ownerOf(1)).to.equal(supporter.address)
            })

            it('Fails if value is below threshold', async function () {
                await expect(supporter.sendTransaction({ to: plantoidInstance.address, value: config.depositThreshold.sub(1)})).to.be.revertedWith(errorMessages.belowThreshold)
            })

            it('Mints an NFT with prereveal uri', async function () {
                await supporter.sendTransaction({ to: plantoidInstance.address, value: ethers.utils.parseEther('1') })
                expect(await plantoidInstance.tokenURI(1)).to.equal(config.prereveal)
            })

            it('Emits an incrementing tokenid on deposits', async function () {
                const tx = await supporter.sendTransaction({ to: plantoidInstance.address, value: ethers.utils.parseEther('1') })
                const receipt = await ethers.provider.getTransactionReceipt(tx.hash)
                const depositAbi = ['event Deposit(uint256 amount, address sender, uint256 indexed tokenId)']
                let iface = new ethers.utils.Interface(depositAbi)
                let log = iface.parseLog(receipt.logs[0])
                expect(log.args.tokenId).to.equal(1)
                const tx2 = await supporter.sendTransaction({ to: plantoidInstance.address, value: ethers.utils.parseEther('1') })
                const receipt2 = await ethers.provider.getTransactionReceipt(tx2.hash)
                let log2 = iface.parseLog(receipt2.logs[0])
                expect(log2.args.tokenId).to.equal(2)
            })
        })
    })

    describe('setting metadata', function () {
        it('Allows supporter to set metadata with signature from plantoid oracle', async function () {
            await supporter.sendTransaction({ to: plantoidInstance.address, value: ethers.utils.parseEther('1') })
            const tokenId = 1
            const testUri = 'test'
            const msgHash = ethers.utils.arrayify(
                ethers.utils.solidityKeccak256(['uint256', 'string', 'address'], [tokenId, testUri, plantoidInstance.address])
            )
            const sig = await plantoidOracle.signMessage(msgHash)
            await plantoidAsSupporter.revealContent(tokenId, testUri, sig)
            expect(await plantoidInstance.tokenURI(1)).to.equal('test')
            expect(await plantoidInstance.revealed(1)).to.equal(true)
        })
        it('Fails if nft not minted', async function () {
            const tokenId = 1
            const testUri = 'test'
            const msgHash = ethers.utils.arrayify(
                ethers.utils.solidityKeccak256(['uint256', 'string', 'address'], [tokenId, testUri, plantoidInstance.address])
            )
            const sig = await plantoidOracle.signMessage(msgHash)
            await expect(plantoidAsSupporter.revealContent(tokenId, testUri, sig)).to.be.revertedWith(errorMessages.notMinted)
        })
        it('Fails if already revealed', async function () {
            await supporter.sendTransaction({ to: plantoidInstance.address, value: ethers.utils.parseEther('1') })
            const tokenId = 1
            const testUri = 'test'
            const msgHash = ethers.utils.arrayify(
                ethers.utils.solidityKeccak256(['uint256', 'string', 'address'], [tokenId, testUri, plantoidInstance.address])
            )
            const sig = await plantoidOracle.signMessage(msgHash)
            await plantoidAsSupporter.revealContent(tokenId, testUri, sig)
            await expect(plantoidAsSupporter.revealContent(tokenId, testUri, sig)).to.be.revertedWith(errorMessages.alreadyRevealed)
        })
    })

    describe('proposals, voting', function () {
        it('Allows people to submit prop if threshold is reached', async function () {
            await supporter.sendTransaction({ to: plantoidInstance.address, value: ethers.utils.parseEther('3') })
            await plantoidAsApplicant.startVoting()
            await plantoidAsApplicant.submitProposal(0, 'test.com')
            expect(await plantoidInstance.proposalCounter(0)).to.equal(1)
            const proposal = await plantoidInstance.proposals(0, 1)
            expect(proposal.proposalUri).to.equal('test.com')
            expect(proposal.proposer).to.equal(applicant.address)
        })

        it('Returns the max votes in a round', async function () {
            await supporter.sendTransaction({ to: plantoidInstance.address, value: config.threshold })
            await supporter.sendTransaction({ to: plantoidInstance.address, value: ethers.utils.parseEther('0.01') })
            await supporter.sendTransaction({ to: plantoidInstance.address, value: ethers.utils.parseEther('0.01') })
            await supporter.sendTransaction({ to: plantoidInstance.address, value: ethers.utils.parseEther('0.01') })
            await supporter.sendTransaction({ to: plantoidInstance.address, value: ethers.utils.parseEther('0.01') })
            await supporter.sendTransaction({ to: plantoidInstance.address, value: ethers.utils.parseEther('0.01') })
            await plantoidAsApplicant.startVoting()
            await plantoidAsApplicant.submitProposal(0, 'test.com')
            await plantoidAsApplicant.submitProposal(0, 'test.com')
            await plantoidAsApplicant.submitProposal(0, 'test.com')

            await plantoidAsSupporter.submitVote(0, 1, [1, 2])
            await plantoidAsSupporter.submitVote(0, 2, [4, 5, 6])
            await plantoidAsSupporter.submitVote(0, 3, [3])

            expect(await plantoidInstance.maxVotes(0)).to.equal(3)
        })

        it('Returns the max votes in a round when tied', async function () {
            await supporter.sendTransaction({ to: plantoidInstance.address, value: config.threshold })
            await supporter.sendTransaction({ to: plantoidInstance.address, value: ethers.utils.parseEther('0.01') })
            await supporter.sendTransaction({ to: plantoidInstance.address, value: ethers.utils.parseEther('0.01') })
            await supporter.sendTransaction({ to: plantoidInstance.address, value: ethers.utils.parseEther('0.01') })
            await supporter.sendTransaction({ to: plantoidInstance.address, value: ethers.utils.parseEther('0.01') })
            await supporter.sendTransaction({ to: plantoidInstance.address, value: ethers.utils.parseEther('0.01') })
            await plantoidAsApplicant.startVoting()
            await plantoidAsApplicant.submitProposal(0, 'test.com')
            await plantoidAsApplicant.submitProposal(0, 'test.com')

            await plantoidAsSupporter.submitVote(0, 1, [1, 2, 3])
            await plantoidAsSupporter.submitVote(0, 2, [4, 5, 6])

            expect(await plantoidInstance.maxVotes(0)).to.equal(3)
        })

        it('Increments votes per proposal', async function () {
            await supporter.sendTransaction({ to: plantoidInstance.address, value: config.threshold })
            await supporter.sendTransaction({ to: plantoidInstance.address, value: ethers.utils.parseEther('0.01') })
            await supporter.sendTransaction({ to: plantoidInstance.address, value: ethers.utils.parseEther('0.01') })
            await supporter.sendTransaction({ to: plantoidInstance.address, value: ethers.utils.parseEther('0.01') })
            await supporter.sendTransaction({ to: plantoidInstance.address, value: ethers.utils.parseEther('0.01') })
            await supporter.sendTransaction({ to: plantoidInstance.address, value: ethers.utils.parseEther('0.01') })
            await plantoidAsApplicant.startVoting()
            await plantoidAsApplicant.submitProposal(0, 'test.com')
            await plantoidAsApplicant.submitProposal(0, 'test.com')

            await plantoidAsSupporter.submitVote(0, 1, [1, 2, 3])
            await plantoidAsSupporter.submitVote(0, 2, [4, 5, 6])

            expect(await plantoidInstance.votes(0, 1)).to.equal(3)
            expect(await plantoidInstance.votes(0, 2)).to.equal(3)
        })

        it('Marks tokens as voted by proposal id', async function () {
            await supporter.sendTransaction({ to: plantoidInstance.address, value: config.threshold })
            await supporter.sendTransaction({ to: plantoidInstance.address, value: ethers.utils.parseEther('0.01') })
            await supporter.sendTransaction({ to: plantoidInstance.address, value: ethers.utils.parseEther('0.01') })
            await supporter.sendTransaction({ to: plantoidInstance.address, value: ethers.utils.parseEther('0.01') })
            await supporter.sendTransaction({ to: plantoidInstance.address, value: ethers.utils.parseEther('0.01') })
            await supporter.sendTransaction({ to: plantoidInstance.address, value: ethers.utils.parseEther('0.01') })
            await plantoidAsApplicant.startVoting()
            await plantoidAsApplicant.submitProposal(0, 'test.com')
            await plantoidAsApplicant.submitProposal(0, 'test.com')

            await plantoidAsSupporter.submitVote(0, 1, [1, 2, 3])
            await plantoidAsSupporter.submitVote(0, 2, [4, 5, 6])

            expect(await plantoidInstance.voted(0, 1)).to.equal(1)
            expect(await plantoidInstance.voted(0, 2)).to.equal(1)
            expect(await plantoidInstance.voted(0, 4)).to.equal(2)
            expect(await plantoidInstance.voted(0, 5)).to.equal(2)
        })

        it('fails to start voting if threshold not reached', async function () {
            await supporter.sendTransaction({ to: plantoidInstance.address, value: config.threshold.sub(10) })
            await expect(plantoidAsApplicant.startVoting()).to.be.revertedWith(errorMessages.belowThreshold)
        })

        it('fails to submit proposal if voting not started', async function () {
            await expect(plantoidAsApplicant.submitProposal(0, 'test')).to.be.revertedWith(errorMessages.notInVoting)
        })

        it('Allows multiple rounds to be in voting simultaneously', async function () {
            await supporter.sendTransaction({ to: plantoidInstance.address, value: config.threshold.mul(2) })
            await plantoidAsApplicant.startVoting()
            await plantoidAsApplicant.startVoting()
            await plantoidAsApplicant.submitProposal(0, 'test1.com')
            await plantoidAsApplicant.submitProposal(1, 'test2.com')

            expect((await plantoidInstance.proposals(0, 1)).proposalUri).to.equal('test1.com')
            expect((await plantoidInstance.proposals(1, 1)).proposalUri).to.equal('test2.com')
        })

        it('Increments proposal counter per round', async function () {
            await supporter.sendTransaction({ to: plantoidInstance.address, value: config.threshold.mul(2) })
            await plantoidAsApplicant.startVoting()
            await plantoidAsApplicant.startVoting()
            await plantoidAsApplicant.submitProposal(0, 'test1.com')
            await plantoidAsApplicant.submitProposal(0, 'test1.com')
            await plantoidAsApplicant.submitProposal(1, 'test2.com')

            expect(await plantoidInstance.proposalCounter(0)).to.equal(2)
            expect(await plantoidInstance.proposalCounter(1)).to.equal(1)
        })

        it('Allows people to submit vote if voting started', async function () {
            await supporter.sendTransaction({ to: plantoidInstance.address, value: ethers.utils.parseEther('3') })
            await plantoidAsApplicant.startVoting()
            await plantoidAsApplicant.submitProposal(0, 'test.com')
            await plantoidAsSupporter.submitVote(0, 1, [1])
            expect(await plantoidInstance.votes(0, 1)).to.equal(1)
            expect(await plantoidInstance.voted(0, 1)).to.equal(1)
        })

        it('Does not allow people to vote multiple times with same NFT', async function () {
            await supporter.sendTransaction({ to: plantoidInstance.address, value: ethers.utils.parseEther('3') })
            await plantoidAsApplicant.startVoting()
            await plantoidAsApplicant.submitProposal(0, 'test.com')
            await plantoidAsSupporter.submitVote(0, 1, [1])
            await expect(plantoidAsSupporter.submitVote(0, 1, [1])).to.be.revertedWith(errorMessages.alreadyVoted)
        })

        it('Does not allow people to vote for blank proposal', async function () {
            await supporter.sendTransaction({ to: plantoidInstance.address, value: ethers.utils.parseEther('3') })
            await plantoidAsApplicant.startVoting()
            await plantoidAsApplicant.submitProposal(0, 'test.com')
            await expect(plantoidAsSupporter.submitVote(0, 2, [1])).to.be.revertedWith(errorMessages.invalidProposal)
        })

        it('Does not allow people to vote with NFT they do not own', async function () {
            await supporter.sendTransaction({ to: plantoidInstance.address, value: ethers.utils.parseEther('3') })
            await plantoidAsApplicant.startVoting()
            await plantoidAsApplicant.submitProposal(0, 'test.com')
            await expect(plantoidAsApplicant.submitVote(0, 1, [1])).to.be.revertedWith(errorMessages.notOwner)
        })

        it('Allows creator to accept winner', async function () {
            await supporter.sendTransaction({ to: plantoidInstance.address, value: ethers.utils.parseEther('3') })
            await plantoidAsApplicant.startVoting()
            await plantoidAsApplicant.submitProposal(0, 'test.com')
            await plantoidAsSupporter.submitVote(0, 1, [1])
            await fastForwardTime(config.votingPeriod + config.gracePeriod + 1)
            await plantoidInstance.settle(0, 1, false)
            expect(await plantoidInstance.winningProposal(0)).to.equal(1)
        })

        it('Allows creator to veto winner', async function () {
            await supporter.sendTransaction({ to: plantoidInstance.address, value: ethers.utils.parseEther('3') })
            await plantoidAsApplicant.startVoting()
            await plantoidAsApplicant.submitProposal(0, 'test.com')
            await plantoidAsSupporter.submitVote(0, 1, [1])
            await fastForwardTime(config.votingPeriod + config.gracePeriod + 1)
            const oldEnd = await plantoidInstance.votingEnd(0)
            await plantoidInstance.settle(0, 1, true)
            const newEnd = await plantoidInstance.votingEnd(0)
            expect(newEnd.sub(oldEnd).gt(config.extPeriod)).to.be.true
            expect((await plantoidInstance.proposals(0, 1)).vetoed).to.equal(true)
            expect(await plantoidInstance.votes(0, 1)).to.equal(0)
        })

        it('Allows supporters to vote again if vetoed', async function () {
            await supporter.sendTransaction({ to: plantoidInstance.address, value: ethers.utils.parseEther('3') })
            await plantoidAsApplicant.startVoting()
            await plantoidAsApplicant.submitProposal(0, 'test.com')
            await plantoidAsApplicant.submitProposal(0, 'test1.com')
            await plantoidAsSupporter.submitVote(0, 1, [1])
            expect(await plantoidInstance.voted(0, 1)).to.equal(1)
            await fastForwardTime(config.votingPeriod + config.gracePeriod + 1)
            await plantoidInstance.settle(0, 1, true)
            await plantoidAsApplicant.submitProposal(0, 'test2.com')
            await expect(plantoidAsSupporter.submitVote(0, 1, [1])).to.be.revertedWith(errorMessages.vetoed)
            await plantoidAsSupporter.submitVote(0, 2, [1])
            expect(await plantoidInstance.voted(0, 1)).to.equal(2)
        })

        it('Allows winner to spawn new plantoid and sends ETH to creator', async function () {
            await supporter.sendTransaction({ to: plantoidInstance.address, value: ethers.utils.parseEther('3') })
            await plantoidAsApplicant.startVoting()
            await plantoidAsApplicant.submitProposal(0, 'test.com')
            await plantoidAsSupporter.submitVote(0, 1, [1])
            await fastForwardTime(config.votingPeriod + config.gracePeriod + 1)
            await plantoidInstance.settle(0, 1, false)

            const tx = await plantoidAsApplicant.spawn(
                0,
                plantoidOracle.address,
                accounts[0].address,
                [config.depositThreshold,
                config.threshold],
                [config.votingPeriod, config.gracePeriod, config.settlePeriod, config.extPeriod],
                config.name,
                config.symbol,
                config.prereveal
            )
            const plantoid = await getNewPlantoidAddress(tx)

            const newPlantoid = (await Plantoid.attach(plantoid)) as Plantoid

            expect(await newPlantoid.artist()).to.equal(applicant.address)
        })
    })
})

