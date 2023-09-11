import React from "react";
import { gql, useQuery } from "@apollo/client";

import { Table, Button } from "antd";


import PlantoidABI from "../contracts/plantoid";
import { Address } from "../components";

import _ from "lodash";

const { ethers } = require("ethers");

const ipfsBase = "https://gateway.ipfs.io/ipfs/";
// 3. Create out useEffect function



export default function Reveal({
  address,
  plantoidAddress,
  graphData,
  userSigner,
  user,
  round,
  roundState,
  mainnetProvider,
  ipfsContent,
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

          style={{height: '2em', 'font-size':'36px'}}

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
      title: "View NFT",
      key: "uri",
      render: record => (
        <div>
          <Button

        style={{height: '2em', 'font-size':'36px'}}

            disabled={!record.revealed_uri}
            onClick={() => {
              // window.open(record.revealed_uri, "_blank");
              window.open(record.revealed_uri, "theFrame");
              // x = document.getElementById("modal");
              // x.style.display = 'block';

             // executeOnClick();
            }}
          >
            View
          </Button>
        </div>
      ),
    },
  ];

  console.log({ graphData });
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

    // console.log( graphData.seeds)
    console.log({ combinedData });
    console.log({ remainData });

    return (

      
      <div>
        <div style={{ width: 780, margin: "auto", paddingBottom: 64 }}>
          {/* {graphData && graphData.holder ? ( */}
          <br />


          <Button style={{height: '2em', 'font-size':'72px'}}
                        // disabled={!txValue}
                        onClick={() => {
                          /* look how we call setPurpose AND send some value along */
                          feedPlantoid(plantoidAddress, userSigner);
                          /* this will fail until you make the setPurpose function payable */
                        }}
                      >
                        Feed the Plantoid
           </Button>
           <br/><br/><br/>

           <div id="modal" >
            {/* ref={ref} style={{display:'none'}}> */}
            <iframe name="theFrame" id="ifram1" width="900" height="900">
            </iframe>
          </div>   
          <br/>

          Reveal your own NFTs
          <br />
          <Table paginator rows={1}
            dataSource={_.sortBy(holderData, function (o) {
              return -Number(o.tokenId);
            })}
            columns={revealColumns}
            rowKey="id"
          />
          {/* ) : ( */}
          <br />
          {/* Reveal other people's NFTs
          <br />
          <Table
            dataSource={_.sortBy(remainData, function (o) {
              return -Number(o.tokenId);
            })}
            columns={revealColumns}
            rowKey="id"
          /> */}
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


const feedPlantoid = async (plantoidAddress, userSigner) => {
  try {
    await userSigner.sendTransaction({ to: plantoidAddress, value: ethers.utils.parseEther("0.002") });
  } catch (error) {
    console.log({ error });
  }
};

