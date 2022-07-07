import '@nomiclabs/hardhat-web3'
import { task } from 'hardhat/config'
import '@nomiclabs/hardhat-ethers'
import { SignatureDB__factory } from 'typechain'

task('deploy-db', 'Set claim state for contract')
    .setAction(async (taskArgs, { ethers }) => {
        const factory = (await ethers.getContractFactory('TipRelayer')) as SignatureDB__factory


        const tipRelayer = await factory.deploy()

        console.log(`Transaction Hash: ${tipRelayer.deployTransaction.hash}`)

        await tipRelayer.deployed()
        console.log('Transaction confirmed')
    })

