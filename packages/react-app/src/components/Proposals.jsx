import React from "react";
import {useState} from 'react';

import { Button, Input, Divider } from "antd";

import PlantoidABI from "../contracts/plantoid";

const { ethers } = require("ethers");






export default function Proposals( { plantoidAddress, localProvider, proposalsList, proposalCount } ) {

    const [message, setMessage] = useState('');

    const handleChange = event => {
        setMessage(event.target.value);
        console.log('value is:', event.target.value);
    };

    return (

        <div>
        <Input onChange={handleChange} ></Input>

            

            <Button
                onClick={() => {
                    // prosposalsList ? console.log("proposal 0 -------> " + proposalsList[0]) : null;
                    console.log(plantoidAddress);  console.log(message, )
                  submitProposal(plantoidAddress, localProvider, message);
                }}
               
            > Submit Proposal</Button> 


            <Divider />

            {(proposalsList) ?  
                <div>{proposalsList.map(prop => {

                   // if (prop[0] == 0) { return(<div/>) }
                  //  else { 
                        return (
                       <div>
                            {`${prop[0]}, ${prop[1].substring(0,7)}..., ${prop[2]}`}
                            <Button onClick={() => { console.log("voting on prop" + prop[0])}}>vote</Button>
                        </div> 
                    )
                //}
                })}</div> : null
                
            } 


        </div>
    )
}


const submitProposal = async (plantoidAddress, localProvider, msg) => {
    try {

        const plantoid = new ethers.Contract(plantoidAddress, PlantoidABI, localProvider);
        await plantoid.submitProposal(0, msg);
    } catch (error) {
      console.log({ error });
    }
  };

