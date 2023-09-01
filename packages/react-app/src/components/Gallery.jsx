import React from "react";
import { gql, useQuery } from "@apollo/client";

import { Table, Button } from "antd";
import { Divider, Image } from "antd";

import PlantoidABI from "../contracts/plantoid";
import { Address } from "../components";

import _ from "lodash";

const { ethers } = require("ethers");

const ipfsBase = "https://gateway.ipfs.io/ipfs/";





export default function Gallery(
  address,
  plantoidAddress,
  graphData,
  userSigner,
  user,
  round,
  roundState,
  mainnetProvider,
  ipfsContent,
) {

  const MD_QUERY = gql`
  query MdQuery($id: String) @api(contextKey: "apiName") {
    plantoidMetadata(id: $id) {
      id
      seedMetadatas {
        id
        revealedUri
        revealedSignature
      }
    }
  }
`;
const { loading, error, data } = useQuery(MD_QUERY, {
  pollInterval: 2500,
  context: { apiName: "metadata" },
  variables: {
    id: plantoidAddress,
  },
});

const revealColumns = [
{
      title: "Seed",
      key: "token",
      render: record => record.tokenId,
      // sorter: {
      //   compare: (a,b) => a.tokenId - b.tokenId
      // }
}];


if (address) {
  console.log("GRAPH DATA!!!!!!!! ", graphData);

  const combinedData = graphData?.plantoidInstance?.seeds.map(g => {
    if (g.revealed && ipfsContent[g.id]) {
      const revealedData = { ...g, ...ipfsContent[g.id] };
      if (revealedData["animation_url"])
        revealedData["revealed_uri"] = ipfsBase + revealedData["animation_url"].split("ipfs://")[1];
      return revealedData;
    }
    if (!data) return { ...g };
    const revealData = data?.plantoidMetadata?.seedMetadatas.find(s => s.id === g.id);
    console.log("........................................\n");
    console.log({ revealData });
    if (revealData)
      return {
        ...g,
        ...revealData,
      };
    else return { ...g };
  });

  const holderData = combinedData
    ? combinedData.filter(g => g.holder.address.toLowerCase() === address.toLowerCase())
    : [];
  const remainData = combinedData
    ? combinedData.filter(g => g.holder.address.toLowerCase() !== address.toLowerCase())
    : [];

console.log("ahahah", holderData)






  return (
    <div style={{ border: "1px solid #cccccc", padding: 16, width: 800, margin: "auto", marginTop: 64 }}>
      <h2>Plantoid #15</h2>
      <Divider />

Hello !



        <Table
             dataSource={_.sortBy(holderData, function (o) {
              return -Number(o.tokenId);
            })}
            columns={revealColumns}
            rowKey="id"
        />

  


    </div>
  );
          }
}
