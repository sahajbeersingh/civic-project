const supabase = require('../config/supabaseClient.js');

exports.getfeedbacks=async(req,res)=>{
    try{
        const { data, error } = await supabase
        .from('feedback').select();
        if(error)throw error;
        res.status(200).json(data);
    }
    catch(err)
    {
        res.status(500).json({error:err.message});
    }
};

exports.getfeedbackbyid=async(req,res)=>{
    try{
        const{complaint_id}=req.params;
        const{data,error}=await supabase
        .from('feedback').select("*").eq("complaint_id",complaint_id);
        if(error)throw error;
        res.status(200).json({success:true,complaint:data});
    }
    catch(err)
    {
        res.status(500).json({error:err.message});
    }
}

exports.addfeedback=async(req,res)=>{
    try{
        const{complaint_id,text,rating}=req.body;
        const { data, error } = await supabase
        .from('feedback').insert([{complaint_id,text,rating}]).select();
        if(error)throw error;
        res.status(200).json({success:true,feedback:data[0]});
    }
    catch(err)
    {
        res.status(500).json({error:err.message});
    }
};