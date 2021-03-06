import axios from 'axios'
import {MongoClient} from 'mongodb'
import buildHeaders from '../../_utils/buildHeaders'
import buildGqlEndpoint from '../../_utils/buildGqlEndpoint'
import atlasMethods from '../../_utils/atlasMethods'
import dataShapeBilling from '../../_utils/dataShapers/dataShapeBilling'
import { createDBClient } from '../../_utils/atlasMethods';
import verifiedConnection from '../../_middleware/verifiedConnection'


const query =  async (req, res) => {
  
  // no body sent
  if(!req.body) {
    return res.status(400).json({error: true, message: 'No request submitted for handling.'})
  }
  
  // destructure request body
  const {shop, gql, variables, updateDb} = req.body
  
  // if (call Auth !== callAuth) {}
  
  // Validate Incoming
  if(!shop || !gql) {
    return res.status(400).json({error: true, message: 'Missing or incorrect parameters supplied'})
  }

  const client = createDBClient()
  
  try {
    
    await client.connect()
    
    const storeTokenData = await atlasMethods.getStoreTokenById(client, shop)
    
    if(!storeTokenData) {
      return res.status(400).json({error: true, message: 'Missing token from the db'})
    }

    const headers = storeTokenData ? buildHeaders(storeTokenData.shopifyApiToken) : false
    if(!headers) { return res.status(400).json({error: true, message: 'Headers could not be built'})}

    const shopifyResponse = await axios({
      url: buildGqlEndpoint(shop),
      method: 'post',
      data: {
        query: gql,
        variables: variables ? variables : {}
      },
      headers: headers
    })

    // Early return 
    if(!shopifyResponse.data) {
      return res.status(417).json({error: true, message: 'Data was not returned from shopify'})
    }

    if(updateDb) { 
      // @todo move to a switch or do something less rudimentary
      if(updateDb === 'billing') {
        await atlasMethods.updateField(client, shop, updateDb, dataShapeBilling(shopifyResponse))
      }
    }

    return res.status(200).json({ ...shopifyResponse.data })
    
  } catch (error) {
    
    console.error(error)
    return res.status(error.status ? error.status : 500).json({
      error: true, 
      message: error.message,
      request: {shop, gql, variables}
    })

  } finally {
    await client.close()
  }

  // If you reached this everything is all apart
  // Status 418 - I am a teapot.
}

export default verifiedConnection(query)