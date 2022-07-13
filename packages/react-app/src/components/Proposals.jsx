import React from "react";
import { useState } from "react";

import { Button, Input, Divider } from "antd";

import PlantoidABI from "../contracts/plantoid";
import plantoid from "../contracts/plantoid";

const { ethers } = require("ethers");

const { parse, stringify } = require("flatted/cjs");

export default function Proposals({
  plantoidAddress,
  userSigner,
  user,
  graphData,
  round,
}) {
  const [message, setMessage] = useState("");

  const handleChange = event => {
    setMessage(event.target.value);
    console.log("value is:", event.target.value);
  };

    const proposalsList = graphData?.proposals
    const proposalCount = graphData?.proposals.length || 0
    const tokens = graphData?.holder.seedCount
    const totTokens = graphData?.seeds.length
    
    console.log({graphData, tokens, totTokens})
  return (
    <div>
      # of Rounds : {round?.toString()} <br /># of Proposals : {proposalCount.toString()}
      <Divider />
      <Input onChange={handleChange}></Input>
      <Button
        disabled={!message}
        onClick={() => {
          // prosposalsList ? console.log("proposal 0 -------> " + proposalsList[0]) : null;
          console.log(plantoidAddress);
          console.log(message);
          submitProposal(plantoidAddress, userSigner, message);
        }}
      >
        {" "}
        Submit Proposal
      </Button>
      <Divider />
      {proposalsList ? (
        <div>
          {proposalsList.map(prop => {
            console.log({ prop });

            if (prop[0] == 0) {
              return <div />;
            } else {
              console.log({ prop });
              return (
                // <div />
                <div>
                  {/* {`${prop.round}, ${prop[1].substring(0, 7)}..., ${prop[2]}`} */}
                  {`${prop.round}, ${prop.id}, ${prop.uri}`}
                  -- votes: {tokens / totTokens} %
                  <Button
                    onClick={async () => {
                      submitVote(plantoidAddress, userSigner, prop);
                    }}
                  >
                    vote
                  </Button>
                </div>
              );
            }
          })}
        </div>
      ) : null}
    </div>
  );
}

const submitProposal = async (plantoidAddress, userSigner, msg) => {
  try {
    const plantoid = new ethers.Contract(plantoidAddress, PlantoidABI, userSigner);
    await plantoid.submitProposal(0, msg);
  } catch (error) {
    console.log({ error });
  }
};

const submitVote = async (plantoidAddress, userSigner, prop, userTokenIds) => {
  console.log("voting on prop " + prop[0]);
  console.log("userSigner = " + stringify(userSigner));

  try {
    const plantoid = new ethers.Contract(plantoidAddress, PlantoidABI, userSigner);
    //const votokens = Array.from({length: tokens[user] || 1}, (_, i) => i + 1) ;
    //console.log({votokens, prop});
    await plantoid.submitVote(0, prop.proposalId, userTokenIds);

    console.log("hereeeeee");
  } catch (error) {
    console.log({ error });
  }
};
