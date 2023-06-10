import React from "react";
import { gql, useQuery } from "@apollo/client";
import { useState } from "react";

import { Table, Input, Button, Divider } from "antd";

import PlantoidABI from "../contracts/plantoid";
import PlantoidMetdataABI from "../contracts/plantoidMetadata";
import { Address } from "../components";

import _ from "lodash";

const { ethers } = require("ethers");

export default function Reveal({
  address,
  plantoidAddress,
  graphData,
  userSigner,
  user,
  round,
  roundState,
  mainnetProvider,
}) {

  // merge graph data from front page to graph data here
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

  console.log({ loading, error, data });

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
      // sorter: {
      //   compare: (a,b) => a.tokenId - b.tokenId
      // }
    },
    {
      title: "Reveal NFT",
      key: "reveal",
      render: record => (
        <div>
          <Button
            disabled={!record.revealedSignature || record.revealed}
            onClick={() => {
              const revealedUri = record.revealedUri;
              const revealedSignature = record.revealedSignature;

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
      title: "Metadata URI",
      key: "uri",
      render: record => record.uri,
    },
  ];

  console.log({ graphData });
  if (address) {
    console.log("GRAPH DATA!!!!!!!! ", graphData);
    const combinedData = graphData?.holder?.seeds.filter(s => s.plantoid.id === plantoidAddress).map(g => {
      if (!data) return { ...g };
      const revealData  = data?.plantoidMetadata?.seedMetadatas.find(s => s.id === g.id);
      console.log("........................................\n");
      console.log({ revealData });
      if (revealData)
        return {
          ...g,
          ...revealData,
        };
      else return { ...g, };
    });
  
    const remainData = [];
    graphData?.plantoidInstance?.seeds?.forEach(g => {
      if (g?.holder?.address.toLowerCase() == address.toLowerCase()) {
        console.log('remove ',g);
        // do nothing
      } else {
        const revealData  = data?.plantoidMetadata?.seedMetadatas.find(s => s.id === g.id);
      console.log({ revealData });
        console.log('do not remove ',g)
        remainData.push({...g, ...revealData});
      }
    })

    // console.log( graphData.seeds)
    console.log({ combinedData });
    console.log({remainData});
    
    return (
      <div>
        <div style={{ width: 780, margin: "auto", paddingBottom: 64 }}>
          {/* {graphData && graphData.holder ? ( */}
            <br/>Reveal your own NFTs<br/>
            <Table
              dataSource={_.sortBy(combinedData, function (o) {
                return Number(o.tokenId);
              })}
              columns={revealColumns}
              rowKey="id"
            />
          {/* ) : ( */}
            <br/>Reveal other people's NFTs<br/>
            <Table
              dataSource={_.sortBy(remainData, function (o) {
                return Number(o.tokenId);
              })}
              columns={revealColumns}
              rowKey="id"
            />

            
          {/* )} */}
        </div>
      </div>
    );
  } else {
    return <div>No user</div>;
  }
}

const revealMetadata = async (userSigner, tokenUri, tokenId, signature, plantoidAddress) => {
  try {
    const plantoid = new ethers.Contract(plantoidAddress, PlantoidABI, userSigner);
    console.log({ tokenId, tokenUri, signature, plantoidAddress });
    await plantoid.revealContent(tokenId, tokenUri, signature);
  } catch (error) {
    console.log({ error });
  }
};
