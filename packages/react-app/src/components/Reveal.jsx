import React from "react";
import { useState } from "react";

import { Table, Input, Button, Divider } from "antd";

import PlantoidABI from "../contracts/plantoid";
import PlantoidMetdataABI from "../contracts/plantoidMetadata";
import { Address } from "../components";

const { ethers } = require("ethers");

export default function Reveal({ address, userSigner, user, graphData, round, roundState, mainnetProvider }) {

  const plantoidAddress = graphData?.plantoidInstance.id;


  const revealColumns = [
    {
      title: "Holder",
      key: "id",
      render: record => <Address value={record.holder.address} ensProvider={mainnetProvider} fontSize={16} />,
    },
    {
      title: "Seed",
      key: "token",
      render: record => record.tokenId,
    },
    {
      title: "Reveal",
      key: "reveal",
      render: record => (
        <div>
          <Button
            disabled={!record.revealedSignature || record.revealed}
            onClick={() => {
            const revealedUri = record.revealedUri
            const revealedSignature = record.revealedSignature

              // prosposalsList ? console.log("proposal 0 -------> " + proposalsList[0]) : null;
              revealMetadata(userSigner, revealedUri, record.tokenId, revealedSignature, plantoidAddress);
            }}
          >
            Reveal
          </Button>
        </div>
      ),
    },
    {
      title: "URI",
      key: "uri",
      render: record => record.uri,
    },
  ];

  console.log({ graphData });
  if(address) {
    console.log("GRAPH DATA!!!!!!!! ",graphData)
    return (
      <div>
      <div style={{ width: 780, margin: "auto", paddingBottom: 64 }}>
        {graphData ? <Table dataSource={graphData.holder.seeds} columns={revealColumns} rowKey="id" /> : <span>No data</span>}
      </div>
    </div>
    )
  } else {
    return <div>No user</div>
  }
}

const revealMetadata = async (userSigner, tokenUri, tokenId, signature, plantoidAddress) => {
  try {
    const plantoid = new ethers.Contract(plantoidAddress, PlantoidABI, userSigner);
    console.log({tokenId, tokenUri, signature, plantoidAddress})
    await plantoid.revealContent(tokenId, tokenUri, signature);
  } catch (error) {
    console.log({ error });
  }
};
