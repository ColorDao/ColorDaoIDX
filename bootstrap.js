const { writeFile } = require('fs').promises
const Ceramic = require('@ceramicnetwork/http-client').default //localhost
// const Ceramic = require('@ceramicnetwork/core').default // produccion 
const { createDefinition, publishSchema } = require('@ceramicstudio/idx-tools')
const { Ed25519Provider } = require('key-did-provider-ed25519')
const fromString = require('uint8arrays/from-string')

// const CERAMIC_URL = 'http://localhost:7007' //localhost
const CERAMIC_URL =  'https://ceramic-clay.3boxlabs.com'//production

const NoteSchema = {
  $schema: 'http://json-schema.org/draft-07/schema#',
  title: 'Petition',
  type: 'object',
  properties: {
    date: {
      type: 'string',
      format: 'date-time',
      title: 'date',
      maxLength: 30,
    },
    text: {
      type: 'string',
      title: 'text',
      maxLength: 4000,
    },
  },
}

const PetitionListSchema = {
  $schema: 'http://json-schema.org/draft-07/schema#',
  title: 'PetitionList',
  type: 'object',
  properties: {
    petitions: {
      type: 'array',
      title: 'petitions',
      items: {
        type: 'object',
        title: 'NoteItem',
        properties: {
          id: {
            $ref: '#/definitions/CeramicDocId',
          },
          title: {
            type: 'string',
            title: 'title',
            maxLength: 100,
          },
        },
      },
    },
  },
  definitions: {
    CeramicDocId: {
      type: 'string',
      pattern: '^ceramic://.+(\\\\?version=.+)?',
      maxLength: 150,
    },
  },
}

async function run() {
  // The seed must be provided as an environment variable
  const seed = fromString(process.env.SEED, 'base16')
  // Connect to the local Ceramic node
  const ceramic = new Ceramic(CERAMIC_URL)
  // Authenticate the Ceramic instance with the provider
  await ceramic.setDIDProvider(new Ed25519Provider(seed))

  // Publish the two schemas
  const [petitionSchema, petitionListSchema] = await Promise.all([
    publishSchema(ceramic, { content: NoteSchema }),
    publishSchema(ceramic, { content: PetitionListSchema }),
  ])

  // Create the definition using the created schema ID
  const petitionDefinition = await createDefinition(ceramic, {
    name: 'petitions',
    description: 'Simple text petitions',
    schema: petitionListSchema.commitId.toUrl(),
  })

  // Write config to JSON file
  const config = {
    definitions: {
      petitions: petitionDefinition.id.toString(),
    },
    schemas: {
      Petition: petitionSchema.commitId.toUrl(),
      PetitionList: petitionListSchema.commitId.toUrl(),
    },
  }
  await writeFile('./src/config.json', JSON.stringify(config))

  console.log('Config written to src/config.json file:', config)
  process.exit(0)
}

run().catch(console.error)