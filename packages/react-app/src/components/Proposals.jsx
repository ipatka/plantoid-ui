import React from "react";
import {useState} from 'react';

import { Button, Input } from "antd";

import PlantoidABI from "../contracts/plantoid";

const { ethers } = require("ethers");






export default function Proposals( { plantoidAddress, localProvider } ) {

    const [message, setMessage] = useState('');

    const handleChange = event => {
        setMessage(event.target.value);
        console.log('value is:', event.target.value);
    };

    return (

        <div>
        <Input onChange={handleChange} value="hELLO"></Input>

            

            <Button
                onClick={() => {
                    console.log(plantoidAddress);
                  submitProposal(plantoidAddress, localProvider, "msg");
                }}
               
            > Submit Proposal</Button> 

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

