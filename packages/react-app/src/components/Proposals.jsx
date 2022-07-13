import React from "react";
import { useState } from 'react';

import { Button, Input, Divider } from "antd";

import PlantoidABI from "../contracts/plantoid";
import { useBurnerSigner } from "eth-hooks";
import plantoid from "../contracts/plantoid";

const { ethers } = require("ethers");

const {parse, stringify} = require('flatted/cjs');





export default function Proposals({ plantoidAddress, localProvider, user, proposalsList, proposalCount, round, tokens, totTokens }) {

    const [message, setMessage] = useState('');

    const handleChange = event => {
        setMessage(event.target.value);
        console.log('value is:', event.target.value);
    };

    return (

        <div>
            # of Rounds : {round?.toString()} <br />

            # of Proposals : {proposalCount?.toString()}


            <Divider />


            <Input onChange={handleChange} ></Input>



            <Button disabled={!message}
                onClick={() => {
                    // prosposalsList ? console.log("proposal 0 -------> " + proposalsList[0]) : null;
                    console.log(plantoidAddress); console.log(message,)
                    submitProposal(plantoidAddress, localProvider, message);
                }}

            > Submit Proposal</Button>


            <Divider />

            {(proposalsList) ?
                <div>{proposalsList.map(prop => {

                    if (prop[0] == 0) { return (<div />) }
                    else {
                        return (
                            <div>
                                {`${prop[0]}, ${prop[1].substring(0, 7)}..., ${prop[2]}`}
                                -- votes: { tokens[user] / totTokens} %
                                <Button
                                    onClick={ async () => {
                                        submitVote(plantoidAddress, localProvider, prop);
                                    }}>vote</Button>
                            </div>
                        )
                    }
                })}</div> : null

            }


        </div>
    )
}


const submitProposal = async (plantoidAddress, localProvider, msg) => {
    try {

        const plantoid = new ethers.Contract(plantoidAddress, PlantoidABI, localProvider.getSigner());
        await plantoid.submitProposal(0, msg);
    } catch (error) {
        console.log({ error });
    }
};


const submitVote = async (plantoidAddress, localProvider, prop) => {

    console.log("voting on prop " + prop[0]);
    console.log('localprovider = ' + stringify(localProvider.getSigner()));

    try {

        const plantoid = new ethers.Contract(plantoidAddress, PlantoidABI, localProvider.getSigner());
        //const votokens = Array.from({length: tokens[user] || 1}, (_, i) => i + 1) ;
        //console.log({votokens, prop});
        await plantoid.submitVote(0, prop[0], [1,2,3,4]);

        console.log("hereeeeee")

    } catch (error) {
        console.log({ error });
    }
};