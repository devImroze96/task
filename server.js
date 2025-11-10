import express from "express";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import sqlite3 from "sqlite3";


const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const DB_PATH = process.env.DATABASE_URL || path.join(__dirname, "recipes.db");


sqlite3.verbose();
const db = new sqlite3.Database(DB_PATH);
db.exec(fs.readFileSync(path.join(__dirname, "sql/create.sql"), "utf8"));


const app = express();
app.use(express.json());


const REQUIRED = ["title","making_time","serves","ingredients","cost"];
const today = () => new Date().toISOString().slice(0,10);
const toRow = (r)=>({id:r.id,title:r.title,making_time:r.making_time,serves:r.serves,ingredients:r.ingredients,cost:r.cost,created_at:r.created_at,updated_at:r.updated_at});


// POST
app.post("/recipes",(req,res)=>{
  const b=req.body||{};
  const missing=REQUIRED.filter(k=>!b[k]);
  if(missing.length) return res.status(200).json({message:"Recipe creation failed!",required:"title, making_time, serves, ingredients, cost"});
  const now=today();
  db.run(`INSERT INTO recipes(title,making_time,serves,ingredients,cost,created_at,updated_at) VALUES(?,?,?,?,?,?,?)`,
    [b.title,b.making_time,b.serves,b.ingredients,b.cost,now,now],
    function(err){
      if(err) return res.status(500).json({message:"internal error"});
      db.get("SELECT * FROM recipes WHERE id=?",[this.lastID],(e,row)=>{
        if(e) return res.status(500).json({message:"internal error"});
        res.status(200).json({message:"Recipe successfully created!",recipe:[toRow(row)]});
      });
    });
});


// GET list
app.get("/recipes",(_req,res)=>{
  db.all("SELECT * FROM recipes ORDER BY id",(e,rows)=>{
    if(e) return res.status(500).json({message:"internal error"});
    res.status(200).json({recipes: rows.map(toRow)});
  });
});
// GET by id
app.get("/recipes/:id",(req,res)=>{
  db.get("SELECT * FROM recipes WHERE id=?",[req.params.id],(e,row)=>{
    if(e) return res.status(500).json({message:"internal error"});
    if(!row) return res.status(404).json({message:"404 Not Found"});
    res.status(200).json({message:"Recipe details by id",recipe:[toRow(row)]});
  });
});


// PATCH
app.patch("/recipes/:id",(req,res)=>{
  const b=req.body||{};
  const fields=REQUIRED.filter(k=>b[k]!==undefined);
  if(!fields.length) return res.status(404).json({message:"404 Not Found"});
  const sets=fields.map(k=>`${k}=?`);
  const params=fields.map(k=>b[k]).concat(today(), req.params.id);
  db.run(`UPDATE recipes SET ${sets.join(", ")}, updated_at=? WHERE id=?`, params, function(err){
    if(err) return res.status(500).json({message:"internal error"});
    if(this.changes===0) return res.status(404).json({message:"404 Not Found"});
    db.get("SELECT * FROM recipes WHERE id=?",[req.params.id],(e,row)=>{
      if(e) return res.status(500).json({message:"internal error"});
      res.status(200).json({message:"Recipe successfully updated!",recipe:[toRow(row)]});
    });
  });
});


// DELETE
app.delete("/recipes/:id",(req,res)=>{
  db.run("DELETE FROM recipes WHERE id=?",[req.params.id],function(err){
    if(err) return res.status(500).json({message:"internal error"});
    if(this.changes===0) return res.status(404).json({message:"404 Not Found"});
    res.status(200).json({message:"Recipe successfully removed!"});
  });
});
// 404
app.use((_req,res)=>res.status(404).json({message:"404 Not Found"}));
const PORT=process.env.PORT||8080;
app.listen(PORT,()=>console.log("Listening on",PORT));
