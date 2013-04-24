enyo.kind({
	name: "App",
	kind: "FittableRows",
	fit: true,
	components:[
		{kind: "onyx.Toolbar", content: "Hello World"},
		{kind: "enyo.Scroller", fit: true, components: [
			{name: "main", classes: "nice-padding", allowHtml: true}
		]},
		{kind: "onyx.Toolbar", components: [
			{kind: "onyx.Button", content: "Tap me", ontap: "helloWorldTap"}
		]}
	],
	helloWorldTap: function(inSender, inEvent) {
		this.$.main.addContent("The button was tapped.<br/>");
	}
});
//engine.js
/**
 * Quick and dirty 3d engine - Scott Porter <scott@smashcat.org>
 *
 * Can handle multiple objects, transparency, reflectivity, unlimited light sources, object compositing, varying number of verticies per polygon (must lie in plane ofc)
 *
 */

/**
 * Lookup singleton - makes rotations faster than invoking Math.cos(), Math.sin() all the time.
 */
var tbl=(function(){
	var d={
		sin: [],
		cos: [],
		init: function(){
			for(var n=0;n<360;n++){
				d.sin[n]=(Math.sin(3.14159*n/180));
				d.cos[n]=(Math.cos(3.14159*n/180))
			}
		}
	}
	d.init();
	return d;
})();

/**
 * Scene object, contains 3d objects for render
 */
function Scene(outputSurface,numBuffers){
	this.object=[];
	this.light=[];
	this.distance=0;

	// Output surface data
	this.surface=false;
	this.surfaceWidth=0;
	this.surfaceHeight=0;
	this.surfaceBGColor='#000000';
	this.buffer=[];
	this.totalBuffers=0;
	this.bufferRotation=0;
	
	// Origin
	this.ox=0;
	this.oy=0;
	this.oz=0;
	
	// Zoom
	this.zoom=1;

	// Ambient light
	this.ambient=0.1;
	
	// Cull back-facing polygons
	this.cullBack=true;

	this.cullBackFacing=function(x){
		this.cullBack=x;
	}
	
	this.setSurface=function(s){
		var ob=document.getElementById(s);
		if(!s)
			return false;
		this.initialSurface=s;
		this.surfaceWidth=ob.width;
		this.surfaceHeight=ob.height;
	    this.surface=ob.getContext('2d');
		this.setOrigin(this.surfaceWidth/2,this.surfaceHeight/2,6);
		this.cls();
	}
	
	this.rotate=function(a){
		this.bufferRotation=a;
	}

	this.setBuffer=function(ix){
		if(ix==-1){
			this.setSurface(this.initialSurface);
			return;
		}
		this.surface=this.buffer[ix].surface;
	}
	
	this.setOrigin=function(x,y,z){
		this.ox=x;
		this.oy=y;
		this.oz=z;
	}
	
	this.setBGColor=function(c){
		this.surfaceBGColor=c;
	}
	
	this.setAmbient=function(x){
		this.ambient=x;
	}
	
	this.addLight=function(x,y,z,r,g,b){
		this.light.push(this.aLight(x,y,z,r,g,b));
	}
	
	this.moveLight=function(ix,x,y,z){
		this.light[ix].x=x;
		this.light[ix].y=y;
		this.light[ix].z=z;
	}
	
	this.removeLights=function(){
		this.light=[];
	}
	
	this.setZoom=function(z){
		this.zoom=z;
	}
	
	this.cls=function(){
		this.surface.fillStyle=this.surfaceBGColor;
		this.surface.fillRect(0,0,this.surfaceWidth, this.surfaceHeight);
	}
	
	this.addObject=function(o){
		this.object.push(o);
	}
	
	this.removeObjects=function(){
		this.object=[];
	}
	
	this.render=function(){
		var s=this.surface;
		var drawList=[];
		var obNum=this.object.length;
		var avDist=0;
		for(var obN=0;obN<obNum;obN++){
			var o=this.object[obN];
	
			var p=o.poly; // This will eventually be a sorted list base on distance from camera - furthest first
			var pNum=p.length,z0,z1,z2,x0,x1,x2,y0,y1,y2,r,g,b,opacity,reflectivity,c;
			var ox=this.ox,oy=this.oy,oz=this.oz,zoom=this.zoom;
			var xTrans=o.xTrans,yTrans=o.yTrans,zTrans=o.zTrans;
			var numLights=this.light.length;
			var pP=[],pX=[],pY=[],pZ=[],numVerts,pDist,i;
			var oZ=oz+(zTrans/64),
				orgX=ox+((xTrans*zoom)/oZ),
				orgY=oy+((yTrans*zoom)/oZ);
			var obZoom=o.zoom,
				isVisible;

			for(var n=0;n<pNum;n++){
				if(!p[n][6])
					continue; // Switched off

				numVerts=p[n][0].length;
				pX=[];
				pY=[];
				pZ=[];
				pDist=0;

				isVisible=false;
				for(i=0;i<numVerts;i++){
					pP[i]=o.point[ p[n][0][i] ];
					pZ[i]=((zTrans+(pP[i].zr*obZoom))/64)+oz;
					if(pZ[i]<1)
						pZ[i]=1;
					pX[i]=ox+(((xTrans+(pP[i].xr*obZoom))*zoom)/pZ[i]);
					pY[i]=oy+(((yTrans+(pP[i].yr*obZoom))*zoom)/pZ[i]);
					
					if(!isVisible && (
						pX[i]>0 && pX[i]<this.surfaceWidth && pY[i]>0 && pY[i]<this.surfaceHeight)
					)
						isVisible=true;
				}
				if(!isVisible)
					continue;
				if(!this.cullBack || (pX[1]-pX[0])*(pY[2]-pY[0]) - (pY[1]-pY[0])*(pX[2]-pX[0])<0 ){

					var vertList=[];
					for(i=0;i<numVerts;i++){
						pDist+=pZ[i];
						vertList[i*2]=pX[i];
						vertList[(i*2)+1]=pY[i];
					}
					avDist=pDist/numVerts;
					if(avDist>0){
						norm=this.getNormal(
							pP[0].xr,pP[0].yr,pP[0].zr,
							pP[1].xr,pP[1].yr,pP[1].zr,
							pP[2].xr,pP[2].yr,pP[2].zr
						);
						normLen=Math.sqrt(
							( (norm[0]/10)*(norm[0]/10) )+
							( (norm[1]/10)*(norm[1]/10) )+
							( (norm[2]/10)*(norm[2]/10) )
						);
	
						opacity=p[n][4];
						reflectivity=p[n][5];
	
						r=p[n][1]*(this.ambient+((1-reflectivity)/2));
						g=p[n][2]*(this.ambient+((1-reflectivity)/2));
						b=p[n][3]*(this.ambient+((1-reflectivity)/2));
	
	
						// Work the dot product to find angle diff from normals for lighting.
						// Bit heavier on the cpu, but looks nice ;-)
						for(i=0;i<numLights;i++){
							lightVec=this.getVector(
								this.light[i].x*zoom,
								this.light[i].y*zoom,
								this.light[i].z,
								(xTrans*zoom),
								(yTrans*zoom),
								zTrans
							);
							// Get diff between the vectors
							lLen=Math.sqrt(
								( (lightVec[0]/10)*(lightVec[0]/10) )+
								( (lightVec[1]/10)*(lightVec[1]/10) )+
								( (lightVec[2]/10)*(lightVec[2]/10) )
							);
							dp=((lightVec[0]/10)*(norm[0]/10))+((lightVec[1]/10)*(norm[1]/10))+((lightVec[2]/10)*(norm[2]/10));
							cAng=dp/(normLen*lLen);
	
							var distFade=1-(avDist/40);
							
							r+=(this.light[i].r*(cAng*reflectivity*distFade));
							g+=(this.light[i].g*(cAng*reflectivity*distFade));
							b+=(this.light[i].b*(cAng*reflectivity*distFade));
						}
	
						if(r>1)	r=1;
						if(g>1)	g=1;
						if(b>1)	b=1;
	
						drawList.push([vertList,avDist,'rgba('+Math.round(r*255)+','+Math.round(g*255)+','+Math.round(b*255)+','+opacity+')',numVerts*2]);
					}
				}
			}
		}
		num=drawList.length;
		
		var e,maxDist,maxDistIX=0;
		var iterations=0;
		qSort(drawList);

		for(n=0;n<num;n++){
			e=drawList[n];
			s.fillStyle=e[2];
			s.beginPath();
			s.moveTo(e[0][0],e[0][1]);
			for(var i=2;i<e[3];i+=2)
				s.lineTo(e[0][i],e[0][i+1]);
			s.fill();
		}

	}
	
	this.getVector=function(x0,y0,z0,x1,y1,z1){
		if(x0<0){
			x1+=-x0;
			x0=0;
		}
		if(y0<0){
			y1+=-y0;
			y0=0;
		}
		if(z0<0){
			z1+=-z0;
			z0=0;
		}

		return [x1-x0,y1-y0,z1-z0];
	}
	
	this.getNormal=function(
		x0,y0,z0,x1,y1,z1,x2,y2,z2
	){
		if(x0<0){
			x1+=-x0;
			x2+=-x0;
			x0=0;
		}
		if(y0<0){
			y1+=-y0;
			y2+=-y0;
			y0=0;
		}
		if(z0<0){
			z1+=-z0;
			z2+=-z0;
			z0=0;
		}

		var v0x=x1-x0,
			v0y=y1-y0,
			v0z=z1-z0;

		var v1x=x2-x0,
			v1y=y2-y0,
			v1z=z2-z0;

		// bit of vector math now, get the cross-product...
		i=(v0y*v1z)-(v1y*v0z);
		j=(v0x*v1z)-(v1x*v0z);
		k=(v0x*v1y)-(v1x*v0y);
		return [-i,j,-k];
	
	}

	/**
	 * A light source
	 */
	this.aLight=function(lx,ly,lz,lr,lg,lb){
		return {
			x : lx,
			y : ly,
			z : lz,
			r : lr,
			g : lg,
			b : lb
		}
	}
	
	/**
	 * Create display buffers
	 */
	this.addBuffers=function(x){
		this.totalBuffers=x;
		var b=document.getElementsByTagName('body')[0];
		var d=document.createElement('div');
		d.style.display='none';
		b.appendChild(d);
		var h='';
		for(var n=0;n<x;n++){
			var c=document.createElement('canvas');
				c.width=this.surfaceWidth;
				c.height=this.surfaceHeight;
				d.appendChild(c);
				this.buffer[n]={ob : c , surface : c.getContext('2d')};
		}
	}
	
	/**
	 * Blit buffer (ix) to current output surface
	 */
	this.blitBuffer=function(ix){

		this.surface.save();
		this.surface.translate(this.surfaceWidth/2,this.surfaceHeight/2);
		this.surface.rotate(this.bufferRotation);
		this.surface.translate(-this.surfaceWidth/2,-this.surfaceHeight/2);
		this.surface.drawImage(this.buffer[ix].ob,0,0);
		this.surface.restore();
	}
	
	this.setSurface(outputSurface);
	if(numBuffers && numBuffers>0)
		this.addBuffers(numBuffers);
}


/**
 * 3D object instance
 *
 * A 3D object is a collection of polygons, the object
 * contains its own rotation and translation data
 */
function Object3D(){

	this.poly=new Array();
	this.point=new Array();

	// Current rotation
	this.xRot=0;
	this.yRot=0;
	this.zRot=0;

	// Current translation
	this.xTrans=0;
	this.yTrans=0;
	this.zTrans=0;

	// Zoom level for this object
	this.zoom=1;

	/**
	 * Rotate points around x,y,z axis.
	 */
	this.rotate=function(xrot,yrot,zrot){
		var x,y,z,tp=this.point.length;
		if(xrot<0)
			xrot+=360;
		if(yrot<0)
			zrot+=360;
		if(zrot<0)
			zrot+=360;

		this.xRot=Math.round(xrot)%360;
		this.yRot=Math.round(yrot)%360;
		this.zRot=Math.round(zrot)%360;

		var num=this.point.length;
		for(var n=0;n<num;n++){

			x=this.point[n].x;
			y=this.point[n].y;
			z=this.point[n].z;

			crx=tbl.cos[this.xRot];
			srx=tbl.sin[this.xRot];
			cry=tbl.cos[this.yRot];
			sry=tbl.sin[this.yRot];
			crz=tbl.cos[this.zRot];
			srz=tbl.sin[this.zRot];
	
			y3=crx*y-srx*z;
			z3=srx*y+crx*z;
	
			x2=sry*z3-cry*x;
			z3=sry*x+cry*z3;
	
			x3=crz*x2-srz*y3;
			y3=crz*y3+srz*x2;
	
			this.point[n].xr=x3; //tbl.cos[zrot]*x-tbl.sin[zrot]*y;
			this.point[n].yr=y3; //tbl.cos[xrot]*y2-tbl.sin[xrot]*z;
			this.point[n].zr=z3; //tbl.sin[xrot]*y2+tbl.cos[xrot]*z;
		}
	}

	/**
	 * Set zoom level for this object
	 */
	this.setZoom=function(z){
		this.zoom=z;
	}

	/**
	 * Position the object in 3d space
	 */
	this.translate=function(x,y,z){
		this.xTrans=x;
		this.yTrans=y;
		this.zTrans=z;
	}

	/** 
	 * Set the points all in one go
	 *
	 * @param array pData Array of verticies and attributes
	 * index 0 is x, index 1 is y, index 2 is z, 
	 */
	this.setPoints=function(pData){
		var num=pData.length;
		this.point=[];
		for(var n=0;n<num;n++)
			this.addPoint(pData[n][0],pData[n][1],pData[n][2]);
	}
	
	/**
	 * Add a single point
	 */
	this.addPoint=function(x,y,z){
		this.point.push(this.aPoint(x,y,z));
	}

	/** 
	 * Set the polys all in one go
	 *
	 * @param array pData Array of polygon data
	 * @see addPoly 
	 */
	this.setPolys=function(pData){
		var num=pData.length;
		this.poly=[];
		for(var n=0;n<num;n++)
			this.addPoly(
				pData[n][0],
				pData[n][1],pData[n][2],pData[n][3],
				pData[n][4],pData[n][5],pData[n][6]
			);
	}

	/**
	 * Add a polygon to the 3d object.
	 *
	 * @param int p indexes in this.point array (either 3 or 4 points per poly)
	 * @param r red value (0 to 1) for this polygon
	 * @param g green value (0 to 1) for this polygon
	 * @param b blue value (0 to 1) for this polygon
	 * @param int opacity Opacity of the polygon, from 0 (totally transparent) to 1 (totally opaque)
	 * @param int reflectivity from 0 (absorbs all light) to 1 (reflects all light)
	 * @param boolean on If true, the polygon will be displayed if visible. If false, it's not included in the render
	 *
	 * Obviously the indexs in the this.point array must exist!
	 */
	this.addPoly=function(p, r,g,b, opacity,reflectivity,on){
		var c='rgba('+r+','+g+','+b+','+opacity+')';
		this.poly.push([p,r,g,b,opacity,reflectivity,on,c]);
	}

	this.aPoint=function(px,py,pz){
		return {
			x : px,
			y : py,
			z : pz,
			xr : px,
			yr : py,
			zr : pz
		};
	}
}

// Quicksort routine, used to depth-sort polys in drawList, prior to render.
function chgP(a,sIX,eIX,p){
	var pv=a[p][1];
	a.xchg(p,--eIX);
	var s=sIX;
	for(var ix=sIX;ix<eIX;++ix){
		if(a[ix][1]>=pv)
			a.xchg(s++,ix);
	}
	a.xchg(s,eIX);
	return s;
}

Array.prototype.xchg=function(a,b){
	var t=this[a];
	this[a]=this[b];
	this[b]=t;
}

function qSortR(a,sIX,eIX){
	if(eIX-1>sIX) {
		var p=sIX+Math.floor(Math.random()*(eIX-sIX));
		p=chgP(a,sIX,eIX,p);
		qSortR(a,sIX,p);
		qSortR(a,p+1,eIX);
	}
}
function qSort(a){
	iterations=0;
	qSortR(a,0,a.length);
}
//charDefs.js
var charDef={
	a : {
		points : [
			[3,0],	// 0
			[4,0],	// 1
			[3.5,2],	// 2
			[2,5],	// 3
			[5,5],	// 4
			[2.5,6],	// 5
			[4.5,6],	// 6
			[0,8],	// 7
			[2,8],	// 8
			[5,8],	// 9
			[7,8]		// 10
		],
		polys : [
			[0,1,2],
			[0,2,8,7],
			[1,10,9,2],
			[3,4,6,5],
			
			[12,11,13],
			[11,18,19,13],
			[12,13,20,21],
			[14,16,17,15],
			
			[0,7,18,11],
			[1,12,21,10],
			[0,11,12,1],
			[7,8,19,18],
			[9,10,21,20],
			[2,4,15,13],
			[4,3,14,15],
			[3,2,13,14],
			[5,6,17,16],
			[5,16,19,8],
			[6,9,20,17]
		]
	},
	b : {
		points : [
			[0,0],	// 0
			[6,0],	// 1
			[7,1],	// 2
			[2,1.5],	// 3
			[4,1.5],	// 4
			[5,2],	// 5
			[5,3],	// 6
			[7,3],	// 7
			[2,3.5],	// 8
			[4,3.5],	// 9
			[6,4],	// 10
			[2,4.5],	// 11
			[4,4.5],	// 12
			[5,5],	// 13
			[7,5],	// 14
			[5,6],	// 15
			[2,6.5],	// 16
			[4,6.5],	// 17
			[7,7],	// 18
			[0,8],	// 19
			[6,8]		// 20
		],
		polys : [
			[0,3,16,19],
			[0,1,4,3],
			[1,2,5,4],
			[1,2,5,4],
			[5,2,7,6],
			[6,7,10,9],
			[9,10,12],
			[8,9,12,11],
			[12,10,14,13],
			[13,14,18,15],
			[15,18,20,17],
			[16,17,20,19],
			['extrude'],
			[1,0,21,22],
			[0,19,40,21],
			[19,20,41,40],
			[2,1,22,23],
			[7,2,23,28],
			[10,7,28,31],
			[14,10,31,35],
			[18,14,35,39],
			[20,18,39,41],
			[3,4,25,24],
			[8,3,24,29],
			[9,8,29,30],
			[6,9,30,27],
			[5,6,27,26],
			[4,5,26,25],
			[16,11,32,37],
			[11,12,33,32],
			[17,16,37,38],
			[12,13,34,33],
			[13,15,36,34],
			[15,17,38,36]
		]
	},
	c : {
		points : [
			[3,0],		// 0
			[5,0],		// 1
			[1,1],		// 2
			[7,1],		// 3
			[3,2],		// 4
			[5,2],		// 5
			[6,2.5],	// 6
			[0,3],		// 7
			[2,3],		// 8
			[0,5],		// 9
			[2,5],		// 10
			[6,5.5],	// 11
			[3,6],		// 12
			[5,6],		// 13
			[1,7],		// 14
			[7,7],		// 15
			[3,8],		// 16
			[5,8]		// 17
		],
		polys : [
			[1,3,6,5],
			[0,1,5,4],
			[0,4,8,2],
			[2,8,7],
			[7,8,10,9],
			[9,10,14],
			[10,12,16,14],
			[12,13,17,16],
			[13,11,15,17],
			['extrude'],
			[3,1,19,21],
			[1,0,18,19],
			[0,2,20,18],
			[2,7,25,20],
			[7,9,27,25],
			[9,14,32,27],
			[14,16,34,32],
			[16,17,35,34],
			[17,15,33,35],
			[15,11,29,33],
			[11,13,31,29],
			[13,12,30,31],
			[12,10,28,30],
			[10,8,26,28],
			[8,4,22,26],
			[4,5,23,22],
			[5,6,24,23],
			[6,3,21,24]
		]
	},
	d : {
		points : [
			[0,0],	// 0
			[4,0],	// 1
			[2,2],	// 2
			[4,2],	// 3
			[7,2],	// 4
			[5,3],	// 5
			[5,5],	// 6
			[2,6],	// 7
			[4,6],	// 8
			[7,6],	// 9
			[0,8],	// 10
			[4,8]	// 11
		],
		polys : [
			[0,1,3,2],
			[0,2,7,10],
			[7,8,11,10],
			[8,6,9,11],
			[6,5,4,9],
			[5,3,1,4],
			['extrude'],
			[1,0,12,13],
			[0,10,22,12],
			[10,11,23,22],
			[11,9,21,23],
			[9,4,16,21],
			[4,1,13,16],
			[2,3,15,14],
			[3,5,17,15],
			[5,6,18,17],
			[6,8,20,18],
			[8,7,19,20],
			[7,2,14,19]
		]
	},
	e : {
		points : [
			[0,0],		// 0
			[7,0],		// 1
			[2,2],		// 2
			[6,2],		// 3
			[2,3.3],	// 4
			[5,3.3],	// 5
			[2,4.8],	// 6
			[5,4.8],	// 7
			[2,6],		// 8
			[6,6],		// 9
			[0,8],		// 10
			[7,8]		// 11
		],
		polys : [
			[0,1,3,2],
			[0,2,8,10],
			[8,9,11,10],
			[4,5,7,6],
			['extrude'],
			[1,0,12,13],
			[0,10,22,12],
			[10,11,23,22],
			[11,9,21,23],
			[9,8,20,21],
			[8,6,18,20],
			[6,7,19,18],
			[7,5,17,19],
			[5,4,16,17],
			[4,2,14,16],
			[2,3,15,14],
			[3,1,13,15]
		]
	},
	f : {
		points : [
			[0,0],		// 0
			[7,0],		// 1
			[2,2],		// 2
			[6,2],		// 3
			[2,3.3],	// 4
			[5,3.3],	// 5
			[2,4.8],	// 6
			[5,4.8],	// 7
			[0,8],		// 8
			[2,8]		// 9
		],
		polys : [
			[0,1,3,2],
			[0,2,9,8],
			[4,5,7,6],
			['extrude'],
			[1,0,10,11],
			[0,8,18,10],
			[8,9,19,18],
			[9,6,16,19],
			[6,7,17,16],
			[7,5,15,17],
			[5,4,14,15],
			[4,2,12,14],
			[2,3,13,12],
			[3,1,11,13]
		]
	},
	g : {
		points : [
			[3,0],	// 0
			[4,0],	// 1
			[1,1],	// 2
			[6,1],	// 3
			[3,2],	// 4
			[4,2],	// 5
			[7,2],	// 6
			[0,3],	// 7
			[2,3],	// 8
			[5,3],	// 9
			[4,4],	// 10
			[7,4],	// 11
			[0,5],	// 12
			[2,5],	// 13
			[4,5],	// 14
			[5,5],	// 15
			[3,6],	// 16
			[5,6],	// 17
			[7,6],	// 18
			[1,7],	// 19
			[3,8],	// 20
			[5,8]	// 21
		],
		polys : [
			[3,6,9,5],
			[1,3,5],
			[0,1,5,4],
			[2,0,4,8],
			[2,8,7],
			[7,8,13,12],
			[12,13,16,19],
			[19,16,20],
			[20,16,17,21],
			[21,17,18],
			[17,15,11,18],
			[10,11,15,14],
			['extrude'],
			[6,3,25,28],
			[3,1,23,25],
			[1,0,22,23],
			[0,2,24,22],
			[2,7,29,24],
			[7,12,34,29],
			[12,19,41,34],
			[19,20,42,41],
			[20,21,43,42],
			[21,18,40,43],
			[18,11,33,40],
			[11,10,32,33],
			[10,14,36,32],
			[14,15,37,36],
			[15,17,39,37],
			[17,16,38,39],
			[16,13,35,38],
			[13,8,30,35],
			[8,4,26,30],
			[4,5,27,26],
			[5,9,31,27],
			[9,6,28,31]
		]
	},
	h : {
		points : [
			[0,0],	// 0
			[7,0],	// 1
			[2,1],	// 2
			[5,1],	// 3
			[2,3],	// 4
			[5,3],	// 5
			[2,5],	// 6
			[5,5],	// 7
			[2,7],	// 8
			[5,7],	// 9
			[0,8],	// 10
			[7,8],	// 11
		],
		polys : [
			[0,2,8,10],
			[4,5,7,6],
			[1,11,9,3],
			['extrude'],
			[2,0,12,14],
			[0,10,22,12],
			[10,8,20,22],
			[8,6,18,20],
			[6,7,19,18],
			[7,9,21,19],
			[9,11,23,21],
			[11,1,13,23],
			[1,3,15,13],
			[3,5,17,15],
			[5,4,16,17],
			[4,2,14,16]
		]
	},
	i : {
		points : [
			[2.5,0],	// 0
			[6.5,0],	// 1
			[3.5,1],	// 2
			[5.5,1],	// 3
			[3.5,7],	// 4
			[5.5,7],	// 5
			[2.5,8],	// 6
			[6.5,8]	// 7
		],
		polys : [
			[0,1,3,2],
			[2,3,5,4],
			[4,5,7,6],
			['extrude'],
			[1,0,8,9],
			[0,2,10,8],
			[2,4,12,10],
			[4,6,14,12],
			[6,7,15,14],
			[7,5,13,15],
			[5,3,11,13],
			[3,1,9,11]
		]
	},
	j : {
		points : [
			[5,0],		// 0
			[7,0],		// 1
			[0,6],		// 2
			[2,6.5],	// 3
			[5,6.5],	// 4
			[0,7],		// 5
			[7,7],		// 6
			[2,8],		// 7
			[6,8]		// 8
		],
		polys : [
			[0,1,6,8,4],
			[3,4,8,7],
			[2,3,7,5],
			['extrude'],
			[1,0,9,10],
			[0,4,13,9],
			[4,3,12,13],
			[3,2,11,12],
			[2,5,14,11],
			[5,7,16,14],
			[7,8,17,16],
			[8,6,15,17],
			[6,1,10,15]
		]
	},
	k : {
		points : [
			[0,0],		// 0
			[5,0],		// 1
			[2,1],		// 2
			[6,1],		// 3
			[2,3],		// 4
			[3,4],		// 5
			[2,5.5],	// 6
			[0,8],		// 7
			[2,8],		// 8
			[4.5,8],	// 9
			[7,8]		// 10
		],
		polys : [
			[0,2,8,7],
			[1,3,5,4],
			[4,10,9,6],
			['extrude'],
			[2,0,11,13],
			[0,7,18,11],
			[7,8,19,18],
			[8,6,17,19],
			[6,9,20,17],
			[9,10,21,20],
			[10,5,16,21],
			[5,3,14,16],
			[3,1,12,14],
			[1,4,15,12],
			[4,2,13,15]
		]
	},
	l : {
		points : [
			[0,0],		// 0
			[2,1],		// 1
			[2,6.5],	// 2
			[7,6.5],	// 3
			[7,7],		// 4
			[0,8],		// 5
			[6,8]		// 6
		],
		polys : [
			[0,1,2,5],
			[2,3,4,6,5],
			['extrude'],
			[1,0,7,8],
			[0,5,12,7],
			[5,6,13,12],
			[6,4,11,13],
			[4,3,10,11],
			[3,2,9,10],
			[2,1,8,9]
		]
	},
	m : {
		points : [
			[0,0],		// 0
			[1,0],		// 1
			[6,0],		// 2
			[7,0],		// 3
			[3.5,2.5],	// 4
			[2,3.5],	// 5
			[5,3.5],	// 6
			[3.5,5.5],	// 7
			[0,8],		// 8
			[2,8],		// 9
			[5,8],		// 10
			[7,8]		// 11
		],
		polys : [
			[0,5,9,8],
			[0,1,4,7,5],
			[2,3,6,7,4],
			[3,11,10,6],
			['extrude'],
			[1,0,12,13],
			[0,8,20,12],
			[8,9,21,20],
			[9,5,17,21],
			[5,7,19,17],
			[7,6,18,19],
			[6,10,22,18],
			[10,11,23,22],
			[11,3,15,23],
			[3,2,14,15],
			[2,4,16,14],
			[4,1,13,16]
		]
	},
	n : {
		points: [
			[0,0],		// 0
			[2,0],		// 1
			[5,0],		// 2
			[7,0],		// 3
			[2,3.5],	// 4
			[5,4.5],	// 5
			[0,8],		// 6
			[2,8],		// 7
			[5,8],		// 8
			[7,8]		// 9
		],
		polys : [
			[0,1,7,6],
			[1,5,8,4],
			[2,3,9,8],
			['extrude'],
			[0,6,16,10],
			[6,7,17,16],
			[7,4,14,17],
			[4,8,18,14],
			[8,9,19,18],
			[9,3,13,19],
			[3,2,12,13],
			[2,5,15,12],
			[5,1,11,15],
			[1,0,10,11]
		]
	},
	o : {
		points: [
			[1,0],		// 0
			[6,0],		// 1
			[0,1],		// 2
			[7,1],		// 3
			[2.5,1.5],	// 4
			[4.5,1.5],	// 5
			[2,2],		// 6
			[5,2],		// 7
			[2,6],		// 8
			[5,6],		// 9
			[2.5,6.5],	// 10
			[4.5,6.5],	// 11
			[0,7],		// 12
			[7,7],		// 13
			[1,8],		// 14
			[6,8]		// 15
		],
		polys : [
			[0,4,6,2],
			[2,6,8,12],
			[8,10,14,12],
			[10,11,15,14],
			[9,13,15,11],
			[7,3,13,9],
			[1,3,7,5],
			[0,1,5,4],
			['extrude'],
			[0,2,18,16],
			[2,12,28,18],
			[12,14,30,28],
			[14,15,31,30],
			[15,13,29,31],
			[13,3,19,29],
			[3,1,17,19],
			[1,0,16,17],
			[4,5,21,20],
			[5,7,23,21],
			[7,9,25,23],
			[9,11,27,25],
			[11,10,26,27],
			[10,8,24,26],
			[8,6,22,24],
			[6,4,20,22]
		]
	},
	p : {
		points: [
			[0,0],		// 0
			[6,0],		// 1
			[7,1],		// 2
			[2,1.5],	// 3
			[4.5,1.5],	// 4
			[5,2],		// 5
			[5,3],		// 6
			[2,3.5],	// 7
			[4.5,3.5],	// 8
			[7,4],		// 9
			[0,5],		// 10
			[2,5],		// 11
			[6,5],		// 12
			[0,8],		// 13
			[2,8]		// 14
		],
		polys : [
			[0,1,4,3],
			[0,3,11,10],
			[10,11,14,13],
			[1,2,5,4],
			[5,2,9,6],
			[6,9,12,8],
			[8,12,11,7],
			['extrude'],
			[0,10,25,15],
			[10,13,28,25],
			[13,14,29,28],
			[14,11,26,29],
			[11,12,27,26],
			[12,9,24,27],
			[9,2,17,24],
			[2,1,16,17],
			[1,0,15,16],
			[3,4,19,18],
			[4,5,20,19],
			[5,6,21,20],
			[6,8,23,21],
			[8,7,22,23],
			[7,3,18,22]
		]
	},
	q : {
		points: [
			[1,0],		// 0
			[6,0],		// 1
			[0,1],		// 2
			[7,1],		// 3
			[2.5,1.5],	// 4
			[4.5,1.5],	// 5
			[2,2],		// 6
			[5,2],		// 7
			[4,4],		// 8
			[3,5],		// 9
			[5,5],		// 10
			[7,5],		// 11
			[2,6],		// 12
			[4,6],		// 13
			[6,6],		// 14
			[2.5,6.5],	// 15
			[3.5,6.5],	// 16
			[0,7],		// 17
			[5,7],		// 18
			[7,7],		// 19
			[1,8],		// 20
			[4,8],		// 21
			[6,8]		// 22
		],
		polys : [
			[0,1,5,4],
			[0,4,6,2],
			[2,6,12,17],
			[17,12,15,20],
			[20,15,16,21],
			[21,16,13,18],
			[9,8,19,22],
			[10,11,14],
			[11,10,7,3],
			[3,7,5,1],
			['extrude'],
			[0,2,25,23],
			[2,17,40,25],
			[17,20,43,40],
			[20,21,44,43],
			[21,18,41,44],
			[18,22,45,41],
			[22,19,42,45],
			[19,14,37,42],
			[14,11,34,37],
			[11,3,26,34],
			[3,1,24,26],
			[1,0,23,24],
			[4,5,28,27],
			[5,7,30,28],
			[7,10,33,30],
			[10,8,31,33],
			[8,9,32,31],
			[9,13,36,32],
			[13,16,39,36],
			[16,15,38,39],
			[15,12,35,38],
			[12,6,29,35],
			[6,4,27,29]
		]
	},
	r : {
		points: [
			[0,0],		// 0
			[6,0],		// 1
			[7,1],		// 2
			[2,1.5],	// 3
			[4.5,1.5],	// 4
			[5,2],		// 5
			[5,3],		// 6
			[2,3.5],	// 7
			[4.5,3.5],	// 8
			[7,4],		// 9
			[0,5],		// 10
			[2,5],		// 11
			[6,5],		// 12
			[0,8],		// 13
			[2,8],		// 14
			[4,5],		// 15
			[5,8],		// 16
			[7,8]		// 17
		],
		polys : [
			[0,1,4,3],
			[0,3,11,10],
			[10,11,14,13],
			[1,2,5,4],
			[5,2,9,6],
			[6,9,12,8],
			[8,12,11,7],
			[11,15,17,16],
			['extrude'],
			[0,10,28,18],
			[10,13,31,28],
			[13,14,32,31],
			[14,11,29,32],
			[15,12,30,33],
			[12,9,27,30],
			[9,2,20,27],
			[2,1,19,20],
			[1,0,18,19],
			[3,4,22,21],
			[4,5,23,22],
			[5,6,24,23],
			[6,8,26,24],
			[8,7,25,26],
			[7,3,21,25],
			[17,15,33,35],
			[16,17,35,34],
			[11,16,34,29]
		]
	}
};

function preprocessChars(){
	var n,p,i,i2,aP=[];

	// preprocess characters
	for(p in charDef){
		var a=charDef[p]['points'],aP=[];
		var l=a.length;
		for(n=0;n<l;n++){
			aP[n]=[a[n][0]-3.5,a[n][1]-4,-1];
			aP[n+l]=[a[n][0]-3.5,a[n][1]-4,1];
		}
		charDef[p]['points']=aP;
		var a=charDef[p]['polys'];
		var l2=a.length;
		var tmpA=[]
		for(n=0;n<l2;n++){
			if(a[n][0]!='extrude'){
				tmpA.push([ a[n], 0.5,0.5,0.5, 1,0.8, true ]);
			}else{
				var tL=tmpA.length;
				for(i=0;i<tL;i++){
					var e=tmpA[i],
						tArr=[];
					for(i2=0;i2<e[0].length;i2++)
						tArr[(e[0].length-1)-i2]=l+e[0][i2];
					tmpA.push([ tArr, 0.5,0.5,0.5, 1,0.8, true ]);
				}
			}
		}
		charDef[p]['polys']=tmpA;
	}
	
	n=0;
	
	for(p in charDef){
		char[n]=new Object3D();
		char[n].setPoints(charDef[p]['points']);
		char[n].setPolys(charDef[p]['polys']);
		char[n].translate(0,0,100);
		char[n].setZoom(20);
		scene.addObject(char[n]);
		++n;
	}

}

/**
 * Set the 3d object list to the string
 */
function setString(ix,string){
	scene.removeObjects();
		
}
