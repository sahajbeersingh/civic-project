module.exports=(req,res,next)=>{
    const{title,description,image_url,location_lat,location_long}=req.body;
    if(!title||!description)
    {
        return res.status(400).json({error:"Title and description are required"});
    }
    next();
};