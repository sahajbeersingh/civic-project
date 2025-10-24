const supabase = require('../config/supabaseClient.js');
const priorityengine = require("../utils/priorityengine");
const { predictCategory } = require("../ml/textclassifer.js");

exports.getcomplaints=async(req,res)=>{
    try{
        const{status}=req.query;
        const{category}=req.query;
        const{sort}=req.query;
        const{page,limit}=req.query;
        const offset=(page-1)*limit;
        let q=supabase.from('complaints').select();
        if(status)q=q.eq('status',status);
        if(category)q=q.eq('category',category);
        if(sort)q=q.order("priority",{ascending:false});
        if(page&&limit)q=q.range(offset, offset+limit-1);
        const { data, error } = await q;
        if(error)throw error;
        res.status(200).json(data);
    }
    catch(err)
    {
        res.status(500).json({error:err.message});
    }
};

exports.getcomplaintbyid=async(req,res)=>{
    try{
        const{id}=req.params;
        const{data,error}=await supabase
        .from('complaints').select("*").eq("id",id).single();
        if(error)throw error;
        res.status(200).json({success:true,complaint:data});
    }
    catch(err)
    {
        res.status(500).json({error:err.message});
    }
}

exports.getpending=async(req,res)=>{
    try{
        const{status}=req.query;
        const{data,error}=await supabase
        .from('complaints').select().eq("status",status);
        if(error)throw error;
        res.status(200).json({success:true,pending_complaints:data});
    }
    catch(err)
    {
        res.status(500).json({error:err.message});
    }
}

exports.createcomplaint=async(req,res)=>{
    try{
        const{title,description,image_url,location_lat,location_long}=req.body;
        const priority=priorityengine.calculatePriority(description);
        const category = await predictCategory(description);
        const{data,error} = await supabase
        .from('complaints').insert([{title,description,category,image_url,location_lat,location_long,priority}]).select();
        if(error)throw error;
        res.status(200).json(data[0]);
    }
    catch(err)
    {
        res.status(500).json({error:err.message});
    }
};

exports.updatecomplaint=async(req,res)=>{
    try{
        const{id}=req.params;
        const{status}=req.body;
        const{data,error}=await supabase
        .from('complaints').update({status}).eq("id",id).select();
        if(error)throw error;
        res.status(200).json({success:true,updated_complaint:data});
    }
    catch(err)
    {
        res.status(500).json({error:err.message});
    }
};