import { store, Bytes, BigInt } from '@graphprotocol/graph-ts'
import { ProposalSubmitted, Transfer, Voted, VotingStarted } from '../generated/templates/Plantoid/Plantoid'
import { PlantoidSpawned } from '../generated/PlantoidSpawn/PlantoidSpawn'
import { Seed, Holder, Proposal, PlantoidInstance, Vote, Round } from '../generated/schema'
import { Plantoid } from '../generated/templates'

export function handleNewPlantoid(event: PlantoidSpawned): void {
    // Start indexing the exchange; `event.params.exchange` is the
    // address of the new exchange contract
    Plantoid.create(event.params.plantoid)
    let newAddress = event.params.plantoid.toHex()
    let newPlantoid = new PlantoidInstance(newAddress)
    newPlantoid.save()
}
let ZERO_ADDRESS_STRING = '0x0000000000000000000000000000000000000000'

let ZERO_ADDRESS: Bytes = Bytes.fromHexString(ZERO_ADDRESS_STRING) as Bytes
let ZERO = BigInt.fromI32(0)
let ONE = BigInt.fromI32(1)

// function setCharAt(str: string, index: any, char: string): string {
//     if (index > str.length - 1) return str
//     return str.substring(0, index) + char + str.substring(index + 1)
// }
// function normalize(strValue: string): string {
//     if (strValue.length === 1 && strValue.charCodeAt(0) === 0) {
//         return ''
//     } else {
//         for (let i = 0; i < strValue.length; i++) {
//             if (strValue.charCodeAt(i) === 0) {
//                 strValue = setCharAt(strValue, i, '\ufffd') // graph-node db does not support string with '\u0000'
//             }
//         }
//         return strValue
//     }
// }

export function handleSeedTransfer(event: Transfer): void {
    // let contract = Plantoid.bind(event.address)
    let from = event.params.from.toHex()
    let to = event.params.to.toHex()
    let id = event.params.tokenId.toHexString()

    if (from != ZERO_ADDRESS_STRING) {
        let sender = Holder.load(from)
        if (sender !== null) {
            sender.seedCount = sender.seedCount.minus(ONE)
        }
    }

    if (to != ZERO_ADDRESS_STRING) {
        let newOwner = Holder.load(to)
        if (newOwner === null) {
            newOwner = new Holder(to)
            newOwner.seedCount = ZERO
            newOwner.address = event.params.to
            newOwner.createdAt = event.block.timestamp
        }

        let seed = Seed.load(id)
        if (seed == null) {
            seed = new Seed(id)
            seed.tokenId = event.params.tokenId
            seed.createdAt = event.block.timestamp
            seed.holder = to
            seed.revealed = false
            seed.uri = ''
            // let metadataURI = contract.try_tokenURI(id)
            // if (!metadataURI.reverted) {
            //     seed.uri = normalize(metadataURI.value)
            // }
        }

        seed.holder = newOwner.id
        seed.save()

        newOwner.seedCount = newOwner.seedCount.plus(ONE)
        newOwner.save()
    } else {
        store.remove('Seed', id)
    }
}

export function handleProposalSubmitted(event: ProposalSubmitted): void {
    let from = event.params.proposer.toHex()
    let uri = event.params.proposalUri
    let roundId = event.address.toHexString() + '_' + event.params.round.toHexString()
    let id = event.address.toHexString() + '_' + event.params.round.toHexString() + '_' + event.params.proposalId.toHexString()

    let proposer = Holder.load(from)
    if (proposer === null) {
        proposer = new Holder(from)
        proposer.address = event.params.proposer
        proposer.seedCount = ZERO
        proposer.createdAt = event.block.timestamp
    }

    proposer.save()

    let round = Round.load(roundId)
    if (round === null) {
        round = new Round(roundId)
        round.save()
    }

    let proposal = new Proposal(id)
    proposal.proposer = from
    proposal.voteCount = ZERO
    proposal.uri = uri
    proposal.round = roundId
    proposal.vetoed = false
    proposal.proposalId = event.params.proposalId

    proposal.save()
}

export function handleVoted(event: Voted): void {
    let from = event.params.voter.toHex()
    let roundId = event.address.toHexString() + '_' + event.params.round.toHexString()
    let votes = event.params.votes
    let choice = event.params.choice.toHexString()
    let id = roundId + '_' + from

    let proposalId = event.params.round.toHexString() + '_' + event.params.choice.toHexString()

    let voter = Holder.load(from)
    if (voter === null) {
        voter = new Holder(from)
        voter.address = event.params.voter
        voter.seedCount = ZERO
        voter.createdAt = event.block.timestamp
    }

    voter.save()

    let vote = new Vote(id)
    vote.voter = from
    vote.round = roundId
    vote.proposal = proposalId
    vote.eligibleVotes = votes

    vote.save()
}

export function handleVotingStarted(event: VotingStarted): void {
    let round = event.params.round.toHexString()
    let end = event.params.end

    let newRound = new Round(round)
    // newRound.votingEnd = end

    newRound.save()
}
