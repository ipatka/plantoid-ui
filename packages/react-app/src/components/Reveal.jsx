import React from "react";
import { useState } from "react";

import { Table, Input, Button, Divider } from "antd";

import PlantoidABI from "../contracts/plantoid";
import PlantoidMetdataABI from "../contracts/plantoidMetadata";
import { Address } from "../components";

const { ethers } = require("ethers");

export default function Reveal({ address, userSigner, user, graphData, round, roundState, mainnetProvider }) {
  const [message, setMessage] = useState("");

  const handleChange = event => {
    setMessage(event.target.value);
    console.log("value is:", event.target.value);
  };

  // const plantoidMetadataAddress = '0x9fE46736679d2D9a65F0992F2272dE9f3c7fa6e0' // TODO fetch from query
  const plantoidMetadataAddress = '0xB36d0593c0659996611e854b1d7797bF7829BbEE' // TODO fetch from query
  const plantoidAddress = graphData?.plantoidInstance.id;

  const oracleColumns = [
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
            disabled={!message}
            onClick={() => {
              // prosposalsList ? console.log("proposal 0 -------> " + proposalsList[0]) : null;
              console.log({ plantoidMetadataAddress, plantoidAddress });
              console.log(message);
              oracleSubmitMetadata(plantoidMetadataAddress, userSigner, message, record.tokenId, plantoidAddress);
            }}
          >
            Reveal
          </Button>
        </div>
      ),
    },
  ];

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
  return (
    <div>
      {address && graphData && address.toLowerCase() === graphData.plantoidInstance.oracle && (
        <span>Oracle Connected</span>
      )}
      <Input onChange={handleChange}></Input>
      <div style={{ width: 780, margin: "auto", paddingBottom: 64 }}>
        {graphData ? <Table dataSource={graphData.seeds} columns={oracleColumns} rowKey="id" /> : <span>No data</span>}
      </div>
      <Divider />
      <div style={{ width: 780, margin: "auto", paddingBottom: 64 }}>
        {graphData ? <Table dataSource={graphData.seeds} columns={revealColumns} rowKey="id" /> : <span>No data</span>}
      </div>
    </div>
  );
}

const oracleSubmitMetadata = async (plantoidMetadataAddress, userSigner, msg, tokenId, plantoidAddress) => {
  try {
    const plantoidMetadata = new ethers.Contract(plantoidMetadataAddress, PlantoidMetdataABI, userSigner);
    console.log({tokenId, msg, plantoidAddress})
    const msgHash = ethers.utils.arrayify(
      ethers.utils.solidityKeccak256(["uint256", "string", "address"], [tokenId, msg, plantoidAddress]),
    );
    const sig = await userSigner.signMessage(msgHash);
    await plantoidMetadata.revealMetadata(plantoidAddress, tokenId, msg, sig);
  } catch (error) {
    console.log({ error });
  }
};

const revealMetadata = async (userSigner, tokenUri, tokenId, signature, plantoidAddress) => {
  try {
    const plantoid = new ethers.Contract(plantoidAddress, PlantoidABI, userSigner);
    console.log({tokenId, tokenUri, signature, plantoidAddress})
    await plantoid.revealContent(tokenId, tokenUri, signature);
  } catch (error) {
    console.log({ error });
  }
};
