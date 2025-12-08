const express = require('express');
const cors = require('cors');
const app = express();
require("dotenv").config();
const port = process.env.PORT || 5000;
const { MongoClient, ServerApiVersion } = require('mongodb');

// middleware
app.use(cors());
app.use(express.json());

const uri = `mongodb+srv://${process.env.DB_USER}:${process.env.DB_PASS}@cluster0.ba90y0b.mongodb.net/?appName=Cluster0`;

const client = new MongoClient(uri, {
    serverApi: {
        version: ServerApiVersion.v1,
        strict: true,
        deprecationErrors: true,
    }
});

async function run() {
    try {
        
        await client.connect();
        console.log("MongoDB Connected Successfully!");

        const db = client.db('chef_bazar_db');
        const mealsCollection = db.collection('meals');

        //  Get meals with limit (default 6)
        app.get('/meals', async (req, res) => {
            const limit = parseInt(req.query.limit) || 6;
            const result = await mealsCollection.find().limit(limit).toArray();
            res.send(result);
        });

        //  Add a meal
        app.post('/meals', async (req, res) => {
            const meal = req.body;
            const result = await mealsCollection.insertOne(meal);
            res.send(result);
        });

    } catch (error) {
        console.log(error);
    }
}

run().catch(console.dir);

app.get('/', (req, res) => {
    res.send('local chef bazar server running...');
});

app.listen(port, () => {
    console.log(`Server listening on port ${port}`);
});
