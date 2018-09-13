// https://jsfiddle.net/prisoner849/h2s2nnpc/
//https://github.com/mrdoob/three.js/blob/master/examples/canvas_interactive_cubes.html
//http://vuoriov4.com/how-to-reduce-draw-calls-in-three-js

//--------------------------------------------------------------
// Define Variables - Main Vis
// -------------------------------------------------------------

// Geometry
var barheight = 30,     // Initial value.
    barpadding = 0,     // NOT USED
    zoom_p = 0.85,      // TODO -- zoom to just outside the selected bar
    context_pct = 0.0,  // percent of graph area for context view
    partition_w = 1000, // used to assign original co-ords on partition
    partition_h = 1000,  // update this once the height of tree is known
    margin = {top: 20, right: 0, bottom: 0, left: 0} // NOT USED
    width = 1000,
    height = 1000,
    aspect_ratio = 1.6,
    view_offset = 0,
    context_pct = 0.3,
    context_height = 0.3 * height

// Scales
var  x = d3.scaleLinear().domain([0,partition_w])
                         .range([0, partition_w]),
     y = d3.scaleLinear().domain([0,partition_h])
                        .range([0, partition_h]),
     x2 = d3.scaleLinear().domain([0,partition_w])
                         .range([0, partition_w]), //
     y2 = d3.scaleLinear().domain([0,partition_h]) // NOT USED?
                        .range([0, partition_h])
     rads = d3.scaleLinear().domain([0,partition_w])
                        .range([-Math.PI,Math.PI])
                        .clamp(true)
     rads2 = d3.scaleLinear().domain([0,partition_w])
                   .range([-Math.PI,Math.PI])
                   .clamp(true)
     three_x = d3.scaleLinear().domain([0,partition_w]).range([-500,500]),
     three_y = d3.scaleLinear().domain([0,partition_h]).range([500,-500]),
     oldx = d3.scaleLinear().domain([0,partition_w]).range([0,partition_w])

// Data Holders
var  data = {},
     root = {},
     nodes ={},
     all_labels = [],
     nodes_flat = [],
     currentNode = '',
     prevNode = '',
     selected_nodes = [],
     comparator = compareByCategory,
     vis = "IciclePlot",
     update_duration = 200;


// Initial sizing of all nodes
var partition = d3.partition()  //
         .size([partition_w, partition_h])
         .padding(0)
         .round(false);

// Data Sort functions
function sort(comparator) {
   drawIcicle(comparator);
   console.log("Sort ... call update icicle")
   //updateIcicle();
}

var compareByValue = function (a, b) {
     return b.value - a.value;
};
var compareByCategory = function (a, b) {
     return a.data.name > b.data.name
};

//--------------------------------------------------------------
// Define and create SVG/DOM Elements
// -------------------------------------------------------------

var chartDiv = d3.select("#chart")
                 .attr("class","div_rel")
                 .append("div")
                 .attr("id","canvas_holder")
                 .attr("class","div_float")
var view = chartDiv.append("div")
                 .attr("id","canvas_container")
                 .attr("class","div_float")

var view2 = chartDiv.append("div")
                 .attr("id","canvas_container2")
                 .attr("class","div_float")

var svg_holder = d3.select("#chart")
                 .append("div")
                 .attr("id","svg_container")
                 .attr("class","div_float")

var svg = svg_holder.append("svg")
                 .attr("id", "svg_icicle")
                 .style("height", height+view_offset)
                 .style("width", width)

var context = svg.append("g")
                 .attr("class", "context")

var context_group = context.append("g")
                 .attr("class", "brush")

var rect_zoom = svg.append("rect") // zoom rectangle covers large portion only
                 .attr("id", "zoom_rectangle")
                 .attr("class", "zoom")
                 .attr("width", width)
                 .attr("height", height)
                 .attr("transform", "translate(0," + view_offset + ")")

//--------------------------------------------------------------
// BRUSH and ZOOM
// -------------------------------------------------------------
var brush = d3.brushX()
                 .extent([[0, 0], [width, context_height]])
                 .on("brush", brushed)
                 .on("end", brushended);

var zoom = d3.zoom()
                 .scaleExtent([0, Infinity])
                 .translateExtent([[0, 0], [width, height]])
                 .extent([[0, 0], [width, height]])
                 .on("zoom", zoomed)
                 .on("end", zoomended);

function addBrush(){
      console.log("BRUSH ADDED TO CONTEXT")
      // Updates the extent of overlay and brush Elements
      rect_zoom.call(zoom)
      zoom.translateExtent([[0, 0], [width, height]])
                   .extent([[0, 0], [width, height]])
}; // addBrush

//--------------------------------------------------------------
// Helper Functions - SVG/DOM Elements
// -------------------------------------------------------------

function reScale() {

  // recalculate scales based on new window size
  let side_width = d3.select("#sidebar").node().getBoundingClientRect().width
       height = d3.min([0.9*window.innerHeight,
                        0.95*(window.innerWidth-side_width)/aspect_ratio]);
       width = aspect_ratio * height
       svg.style("width", width);
       svg.style("height",height);
       rect_zoom.attr("width", width);

       rect_zoom.attr("height", height);

       //oldx = x.copy()
       x.range([0,width]);
       x.domain([0,aspect_ratio*partition_w]);
       x2.range([0,width]);
       y.range([0,height]);
       y2.range([0,height]);
       d3.select("#canvas_container").style("top", view_offset + "px")
       drawLabels()
       console.log("reScale:", x.domain(), y.domain(), y2.domain())
} // re-scale


//--------------------------------------------------------------
// Load DATA
// -------------------------------------------------------------

d3.json('../data/chibrowseoff.json').then(function(data) {

    // Data preparation
    root = d3.hierarchy(data).sum((d) => d.size)
    currentNode = root
    prevNode = root

    // Add unique ID to each node
    root.descendants().forEach(function(d,i){
       all_labels.push(d.data.name);
       return d.id = i;})
    all_labels.sort()
    updateSearchBox()

    // Prepare data
    nodes = partition(root.sort(comparator));
    root.descendants().forEach(function(d,i){
      d.color = stdColor((d.x0+d.x1)/2.0/partition_w)
      d.color_g = grayCol(d.color)
   })
   // y2 = d3.scaleLinear().domain([0,root.height+1])
   //                      .range([0, height])

    init()   // Creates initial setup of charts etc.
    }).catch(function(err) {
    console.log(err);
});  // end load data

//--------------------------------------------------------------
// Initialise Visualisation
// -------------------------------------------------------------
 //OrthographicCamera( left : Number, right : Number, top : Number, bottom : Number, near : Number, far : Number )

 var camera, scene, renderer;
 var objects = [];
 var mesh, mesh_line, mesh_context, mesh_line_context, mesh_highlight, innerCircles, p1, p2;
 var zoom_x = 1, position_x = 0
 var view, arrow
 var raycaster = new THREE.Raycaster();
 var mouse = new THREE.Vector2()
 var mesh_circles = [], circleIDs = [];
 var mesh_context_group = new THREE.Group();
 var mesh_group = new THREE.Group();
 var pivot = new THREE.Object3D();

function init(){

   // set geometry and data for vis
   barheight = 0.5* partition_h / (root.height+2) // fills vis
   thelist = root.descendants().sort(compareByValue)

   // create camera - aspect ratio for scaling of vis
   camera = new THREE.OrthographicCamera(
               aspect_ratio*partition_w / - 2, aspect_ratio*partition_w / 2,
               partition_h / 2, partition_h / - 2, 1, 1000 );
   camera.position.z = 20;

   // Set the scene
   scene = new THREE.Scene();
   scene.background = new THREE.Color( 0xffffff );
   scene.add( camera );

   reScale() // updated heights/widths
   renderer = new THREE.WebGLRenderer({
            alpha: false,
            antialias: true,
            preserveDrawingBuffer: true });
      //renderer.autoClear = false;
   renderer.setSize(width,height);
   renderer.setPixelRatio(window.devicePixelRatio);
   container = document.getElementById("canvas_container");
   container.appendChild(renderer.domElement)


   // Main mesh for sunburst
   mesh = make_sunburst(thelist, false, true)
   mesh_line = make_sunburst_lines(thelist)
   mesh_line_h = make_rings()
   mesh_circles_group = makeInnerCircles()

   mesh_group.add(mesh_circles_group)
   mesh_group.add(mesh_line_h)
   mesh_group.add(mesh)
   mesh_group.add(mesh_line)

   // Set mesh_group positions and rotations
   mesh_circles_group.position.z = 1
   mesh_line_h.position.z = 5 // always in front
   mesh_group.rotation.z = Math.PI/2
   mesh_group.position.y = partition_h/2-context_pct*barheight*(root.height+4)
   mesh_group.position.y = 0
   // Add mesh group to scene
   scene.add(mesh_group)

   // Mesh for context view
   mesh_context = new THREE.Mesh(mesh.geometry.clone(),mesh.material.clone())
   mesh_line_context = new THREE.LineSegments(mesh_line.geometry.clone(), mesh_line.material.clone())
   mesh_context_group.add(mesh_context)
   mesh_context_group.add(mesh_line_h.clone())
   mesh_context_group.add(mesh_line_context)
   scene.add(mesh_context_group )

   mesh_line_context.position.z = 5
   mesh_context_group.rotation.z = Math.PI/2
   mesh_context_group.position.y = 350
   mesh_context_group.position.x = -650
   mesh_context_group.scale.x = mesh_context_group.scale.y = context_pct

   // Pointers for context review
   p1 = makePointer()
   p2 = makePointer()
   mesh_context_group.add(p1)
   mesh_context_group.add(p2)
   p1.position.z = p2.position.z = 10
   p2.rotation.z = +rads2(rads.domain()[1])+Math.PI/2

   // Final updates for initialisation
   updateMorphs()
   updateInnerCircleColor(mesh_circles[0], 0xFFFFFF)
   updateInnerCircleColor(mesh_circles[1], thelist[0].color)

   rect_zoom.on("mousemove", function() {
                  mouse.x = ( d3.mouse(this)[0] / renderer.domElement.clientWidth ) * 2 - 1;
                  mouse.y = - ((d3.mouse(this)[1]) / renderer.domElement.clientHeight ) * 2 + 1;
                 onMousemove()})
             .on("mousedown", function() {
                   zoomStart = {started:Date.now(),x:d3.mouse(this)[0],
                   y:d3.mouse(this)[1]}
                   mouseTrack = {x:d3.mouse(this)[0],             y:d3.mouse(this)[1]}
                })
             .on("mouseout", function(){
                 tooltip.style("display","none")})

   // Add Listeners
   window.addEventListener( 'resize', onWindowResize, false );

   addBrush()
   //drawLabels()
} // init

//--------------------------------------------------------------
// MESH definitions - SUNBURST
// -------------------------------------------------------------
var face_id = []
var radial_zoom = 1
var radial_rotation =  Math.PI
var mesh_circles_group = new THREE.Group();
var morphDepth = 1 // check if still used

/// SUNBURST ---------------------------------------
function make_sunburst(theList){
     face_id = []
     var vertices_id = []
     var planeMaterial = new THREE.MeshBasicMaterial(
                      {color: 0xffffff, vertexColors: THREE.FaceColors, opacity:0.95, transparent:false, morphTargets:true, wireframe: false  })

      material = new THREE.MeshBasicMaterial( {color: 0xffffff, wireframe: false, morphTargets: true  } );
      //ringGeometry10 = ringGeometry.clone().thetaSegment

    var g = new THREE.Geometry();

   theList.forEach(function(d,i){
                sweep = rads(d.x1) - rads(d.x0)
                start_angle = rads(d.x0)
                rotation = radial_rotation

                if (d.x1-d.x0<=0.2){
                   segments = 6
                } else if (d.x1-d.x0<1) {
                   segments = 36
                } else {
                   segments = 72
                }

                   var ringGeometry = new THREE.RingGeometry((d.depth+1)*barheight,   (d.depth+2)*barheight, segments, 1, start_angle, sweep );

                   var mesh = new THREE.Mesh(ringGeometry);
                   d.faces = [], d.vertices = []
                   for ( var j = 0; j < mesh.geometry.faces.length; j++ ) {
                           mesh.geometry.faces[j].color.set(d.color);
                              face_id.push(i)
                        }
                   for ( var j = 0; j < mesh.geometry.vertices.length; j++ ) {
                              vertices_id.push(i)
                        }
                        g.mergeMesh(mesh);

				}) // for each segment

     g.morphTargets[0]={name:'t1',vertices: g.clone().vertices, angles: [], radius: []}
     for ( var j = 0; j < g.vertices.length; j++ ){
                    v = g.vertices[j]
                    r = (v.x**2+v.y**2)**0.5
                    theta  = Math.atan2(v.y,v.x)
                  //
                   g.morphTargets[0].angles[j] = theta
                   g.morphTargets[0].radius[j] = r
                }

      face_id.map(function(d,index){ thelist[d].faces.push(index)})
      vertices_id.map(function(d,index){ thelist[d].vertices.push(index)})
      return (new THREE.Mesh(g, planeMaterial));
} // make_sunburst

/// SUNBURST ---------------------------------------
function make_sunburst_lines(theList){

      var lineGeometry = new THREE.Geometry();
            lineGeometry.vertices.push(new THREE.Vector3( 0, 0, 0) );
            lineGeometry.vertices.push(new THREE.Vector3( 0, barheight, 0) );
      var lineMaterial = new THREE.LineBasicMaterial(
                           {color: 0xffffff,
                            vertexColors: THREE.VertexColors,
                            opacity:0.4,
                            transparent:true } );

      var g = new THREE.Geometry();

      theList.forEach(function(d,i){
               sweep = rads(d.x1) - rads(d.x0)
               start_angle = rads(d.x0)
               angle = sweep+start_angle//+rotation
               rotation = radial_rotation

               var mesh = new THREE.Mesh(lineGeometry);
               mesh.position.x =(d.depth+1)*barheight*Math.cos(angle);
               mesh.position.y =(d.depth+1)*barheight*Math.sin(angle);
               mesh.rotation.z = sweep+start_angle- Math.PI/2

               //if (sweep <= (0.001)) {
               //   mesh.geometry.colors[0] = new THREE.Color(d.color_g)
               //   } else {
                  mesh.geometry.colors[0] = new THREE.Color(0xffffff)
               //   }
                  mesh.geometry.colors[1] = mesh.geometry.colors[0]
                  g.mergeMesh(mesh);
               });

       g.morphTargets[0]={name:'t1',vertices: g.clone().vertices, angles: [], radius: []}
       for ( var j = 0; j < g.vertices.length; j++ ){
                    v = g.vertices[j]
                    r = (v.x**2+v.y**2)**0.5
                    theta  = Math.atan2(v.y,v.x)
                    g.morphTargets[0].angles[j] = theta
                    g.morphTargets[0].radius[j] = r
                }

               return (new THREE.LineSegments(g, lineMaterial));
} // make_sunburst_lines



/// RINGS ---------------------------------------
function make_rings(){
   var group = new THREE.Group();
   var material = new THREE.LineBasicMaterial( { color : 0xdddddd } );
   for ( var j = 0; j < root.height+2; j ++ ) {
      r = (j+1)*barheight
      var curve = new THREE.EllipseCurve(
   	0,  0,            // ax, aY
   	r,  r,           // xRadius, yRadius
   	-Math.PI,  +Math.PI,  // aStartAngle, aEndAngle
   	false,            // aClockwise
   	0                 // aRotation
      );
      var points = curve.getPoints( 100 );
      var geometry = new THREE.BufferGeometry().setFromPoints( points );
      group.add(new THREE.Line( geometry, material ));
   }
  return (group)
} // make_rings .... one ring per level

/// POINTERS FOR CONTEXT_VIEW  ----------------------------
function makePointer(){
      h = (root.height+2) * barheight
      var planeGeometry = new THREE.PlaneGeometry(4,h);
      planeGeometry.applyMatrix( new THREE.Matrix4().makeTranslation( 0, -h/2, 0 ) )
      var planeMaterial = new THREE.MeshBasicMaterial(
                 {color: 0xff0000, opacity:0.95, transparent:false  })
      return (new THREE.Mesh(planeGeometry, planeMaterial))
} // makePointer

/// INNER CIRCLES to replace over stretched meshes -----------------
function makeInnerCircles(){
     var clearMaterial = new THREE.MeshBasicMaterial({
                  transparent:true,
                  opacity:0.0
                  });
     var solidMaterial =  new THREE.MeshBasicMaterial(
                       {color: 0xffffff, vertexColors: THREE.FaceColors, opacity:0.95, transparent:false  })

     for ( var j = 0; j < root.height+1; j ++ ) {
        var ringGeometry = new THREE.RingGeometry((j)*barheight,   (j+1)*barheight, 36, 1, -Math.PI/2, 2*Math.PI );

     var mesh_circle = new THREE.Mesh(
        ringGeometry, [clearMaterial, solidMaterial]);
     mesh_circle.name = 0
     mesh_circles.push(mesh_circle) // array of all inner circles
     mesh_circles_group.add(mesh_circle)
     }
     return mesh_circles_group

} //makeInnerCircles

//--------------------------------------------------------------
// MESH - VERTICE UPDATES
// -------------------------------------------------------------

// Update vertices for selection, zooming etc.
function updateMorphs(){
         for  (var i = 0; i < 2; i++) {
         if(i==0) {
             g = mesh.geometry
          } else {
             g = mesh_line.geometry
          }
         for ( var j = 0; j < g.vertices.length; j++ ){

         //v = g.morphTargets[0].vertices[j]
         r = g.morphTargets[0].radius[j]
         a = g.morphTargets[0].angles[j]
         // rads clamps these values between the required range
         theta = rads(rads2.invert(a))
         g.vertices[j].x = r * Math.cos(theta)
         g.vertices[j].y = r * Math.sin(theta)
         }
         g.verticesNeedUpdate = true;

         // Update context pointers
         p1.rotation.z = +rads2(rads.domain()[0])+Math.PI/2
         p2.rotation.z = +rads2(rads.domain()[1])+Math.PI/2

      }
  checkReplace()
  render()
  drawLabels()
}

//--------------------------------------------------------------
// MESH - Update COLOR
// -------------------------------------------------------------

// Applies to radial plot
function update_colors_radial(reset_color = true){
   selected_nodes.forEach(function(d) {
      console.log(d)
      if (d.faces){

      d.faces.forEach(function(f) {

         face = mesh.geometry.faces[f]

         if (reset_color) {
            face.color.set(d.color)
         } else {
            face.color.set(d.color_g)
         };
      });
   console.log("New Color:", mesh.geometry.faces[d.faces[0]].color, d.color, reset_color)};
   });

   mesh.geometry.elementsNeedUpdate = true;
   render();

} // update


//--------------------------------------------------------------
// Dealing with inner rings - needs some work
// -------------------------------------------------------------
function checkReplace(){
   var replace = thelist.filter(function(d) {
      return ((d.x0 <= rads.domain()[0]+0.0001) && (d.x1 >= rads.domain()[1]-0.0001))
   })

   // x is already sorted by depth as a result of previous sort on value, and
   // will only ever have one entry per level
   for(i=1; i < replace.length; i++){ // start after root
      if (mesh_circles[i+1].name != thelist.indexOf(replace[i])){
         mesh_circles[i+1].name = thelist.indexOf(replace[i])
         updateInnerCircleColor(mesh_circles[i+1], replace[i].color)
      }
   }
   for(i=replace.length+1; i<root.height+1; i++){ // start after root
         if (mesh_circles[i].name != -1){
         updateInnerCircleColor(mesh_circles[i])
      } else {
         return
      }
   }
}

// Works to replace all inner rings ... but not tweened ....
// Not used
function recursivelyUpdateInnerRing(child){
    console.log("update inner rings", child.id, child.data.name, child.depth)
    mesh_circles[child.depth+1].name = thelist.indexOf(child)
    updateInnerCircleColor(mesh_circles[child.depth+1], child.color)
    if (child.parent) {recursivelyUpdateInnerRing(child.parent)}
}

function resetInnerRings(fromDepth){
    for(i=2; i<root.height; i++){
    updateInnerCircleColor(mesh_circles[i])
   }
}


function updateInnerCircleColor(circle, colour){
    for ( var j = 0; j < circle.geometry.faces.length; j++ ) {
         if(!colour) {
            circle.geometry.faces[j].materialIndex = 0
            circle.name = -1
      } else {
            circle.geometry.faces[j].materialIndex = 1
            circle.geometry.faces[j].color.set(colour)
      }
   };
      circle.geometry.elementsNeedUpdate = true;
      render();
}


//--------------------------------------------------------------
// SVG LABELS
// -------------------------------------------------------------

function nodelist_radial(tolerance){
 // tolerance is in pixels ... i.e. how big to display label?

 return thelist.filter(function(d) {
         //start_angle = rads2(d.x0)
         sweep = rads(d.x1) - rads(d.x0)
         label_angle = rads2((d.x1+d.x0)/2)// translate to shown charts
         if (sweep > Math.PI){
            length = x(2*(d.depth+1)*barheight)
         } else {
            length = x(2*(d.depth+1)*barheight * Math.sin(sweep/2))
         }
         return ((length > tolerance)  &&
                 ((d.x1) > rads.domain()[0]) &&
                  ((d.x0) < rads.domain()[1]))
              })
}

function textPos(d){
         start_angle = rads(d.x0)
         sweep = rads(d.x1) - rads(d.x0)
         if (sweep > Math.PI){
            sweep = 0
            start_angle = 0
         }
         rotate =  -(sweep/2+start_angle)*180/Math.PI
         var midpt_x = width/2-x(Math.sin(start_angle+sweep/2) * (d.depth+1.3)*barheight)
         var midpt_y = y(partition_h/2-mesh_group.position.y) - y(Math.cos(start_angle+sweep/2) * (d.depth+1.3)*barheight)
         if (d.id==6){
            console.log(sweep, start_angle, midpt_x, midpt_y, rotate)
         }
         return "translate(" + midpt_x + "," +  midpt_y + ")rotate("+(rotate)+")";
      }

function drawLabels() {
  labels =  d3.select("#svg_icicle").selectAll("text")
      .data(nodelist_radial(20), function(d) {return d.id})

  labels.enter().append("text")
      .attr("id", function(d) { return 'node_'+d.id; })
      //.attr("dy", ".35em")
      .attr("opacity",0)
      .attr("transform", function(d) {return textPos(d)})
      .merge(labels)
      .attr("class", function(d) {
         if (selected_nodes.includes(d)) {
            return "vislabel selected"
         } else {
            return "vislabel"
         }}
      )
      //.transition()
      //.duration(200)
         //.attr("opacity",0.1)
         .attr("transform", function(d) {return textPos(d)})
         .text(function(d) {
            sweep = rads(d.x1) - rads(d.x0)
            if (sweep > Math.PI){
               length = x(2*(d.depth+1)*barheight)
            } else {
               length = x(2*(d.depth+1)*barheight * Math.sin(sweep/2))
            }
            var text_length = Math.floor(length /6)
            return d.data.name.slice(0,Math.max(0,text_length))})
         .transition()
         .duration(100)
         .attr("opacity",1)
   labels.exit().remove();
}; //drawLabels

//--------------------------------------------------------------
// TWEEN FUNCTIONS
// -------------------------------------------------------------

var tweenTime = 1300;
var tween_current = { scalex: 1, posx:0 };
var tween_target = { scalex: 100, posx:500};

function makeTween_radial(){
   // Scales and rotates
    var tween = new TWEEN.Tween(tween_current).to(tween_target, tweenTime);
    console.log("make Radial Tween:", tween_current, tween_target)
    tween.onUpdate(function(){
               rads.domain([tween_current.min_value, tween_current.max_value])
               updateMorphs()
            })
               .easing(TWEEN.Easing.Cubic.InOut)
   .start();
} // makeTween


function morphTo(tgt_min=0, tgt_max=1000,tgt_rotation=radial_rotation) {
       tween_current = {min_value: rads.domain()[0],
                        max_value: rads.domain()[1],
                         rotation: mesh.rotation.z}
       tween_target = {min_value: tgt_min,
                        max_value: tgt_max,
                         rotation: tgt_rotation}
    makeTween_radial()

    t = d3.timer(function(elapsed) {
           TWEEN.update();
           if (elapsed > 2*tweenTime){
           t.stop()
           }
          renderer.render(scene, camera);
     });
};


//--------------------------------------------------------------
// RENDER
// -------------------------------------------------------------

function render() {
      renderer.render(scene, camera);
}

//--------------------------------------------------------------
// EVENT LISTENERS
// -------------------------------------------------------------

function onWindowResize() {
      reScale()
		camera.aspect = 1
      console.log("window resize to:", width, height)
		renderer.setSize(height*aspect_ratio,height);
      camera.updateProjectionMatrix();
      addBrush()
      drawLabels()
}


//--------------------------------------------------------------
// BRUSHING / ZOOMING
// -------------------------------------------------------------

var zoomStart = {started: 0, x:0, y:0}
var mouseTrack = {x:0, y:0}

function zoomed() {

  if (d3.event.sourceEvent && d3.event.sourceEvent.type === "brush") return; // ignore zoom-by-brush

  tooltip.style("display","none")
  var t = d3.event.transform;

  old_zoom = zoom_x
  zoom_x = t.k;

  x1_ = rads.domain()[1]
  x0_ = rads.domain()[0]
  m = (mouseTrack.x - d3.mouse(this)[0])
  deltaT = 0
  deltaZ = 0

  if (old_zoom != zoom_x) {
     deltaZ = ((x1_ - x0_)*(old_zoom/zoom_x-1))/4
  } else if (m != 0) {
        z = rads2.domain()[1]/(x1_-x0_)
        deltaT = 2*x2.invert(m)/z
 }

  console.log("zoomStart", rads.domain(), zoom_x == old_zoom, m, deltaT, deltaZ,x0_-deltaZ+deltaT, x1_+deltaZ+deltaT)

  rads.domain([rads2.invert(rads2(x0_-deltaZ+deltaT)),
                   rads2.invert(rads2(x1_+deltaZ+deltaT))]);


  mouseTrack.x = d3.mouse(this)[0]

  // get clamping from scales



  updateMorphs()
  checkReplace()
  g.verticesNeedUpdate = true;
  render()
  //morphTo(rads.domain()[0], d.x1, target2)
  //x.domain(t.rescaleX(x2).domain());
  //y.domain(t.rescaleY(y2).domain());

  //updateGL()  // update graphics layer
  //console.log("zoomed",t)
  // update the brush
  //context_group.call(brush.move, x.range().map(t.invertX, t));
}


function brushed() {
   console.log("brushed")
   return
  if (d3.event.sourceEvent && d3.event.sourceEvent.type === "zoom") return; // ignore brush-by-zoom
  //if (d3.event.sourceEvent) console.log(d3.event.sourceEvent.type);

  var s = d3.event.selection || x2.range();
  console.log("brushed", s)
  x.domain(s.map(x2.invert));
  y.domain(s.map(y2.invert));
  zoom_x = width / (s[1]-s[0])
  // update the zoom and translate settings associated with zoom area
  rect_zoom.call(zoom.transform, d3.zoomIdentity
      .scale(zoom_x)
      .translate(-s[0], +s[1]));

  updateGL()  // update graphics layer
  drawLabels()
}


function brushended(){
    return
    if (!d3.event.sourceEvent) return; // Only transition after input.
    drawLabels()
    if (d3.event.sourceEvent && d3.event.sourceEvent.type === "zoom") return;
    //console.log("brushended2", update_duration, d3.event.sourceEvent  )
    update_mesh(zoom_x)

 };

function zoomTo(coords){
   console.log("!!!!! --> should be using MorphTo")
   return
   let x0_ = coords[0], x1_ = coords[1]
   if (x0_ == x1_) return
   tween_current = {scalex: zoom_x, posx:x.domain()[0], posx1: x.domain()[1]}

   console.log(coords, x0_, x1_)
   dz = (x1_ - x0_) * (1 - zoom_p) / (2 * zoom_p)
   x0_ = d3.max([x0_-dz,0])
   x1_ = d3.min([x1_+dz,partition_w])
   zoom_x = 1000 / (x1_-x0_)
   x.domain([x0_, x1_]);

   rect_zoom.call(zoom.transform, d3.zoomIdentity
       .scale(zoom_x)
       .translate(-x2(x0_), 0));

   tween_target = {scalex: zoom_x,
                     posx:  x.domain()[0],
                     posx1: x.domain()[1]} // * ((d.x0))
   //console.log("tween ...", d.data.name, d.x0, d.x1, d3.mouse(this), tween_current, tween_target)
   render_tween()
}


function zoomended(){
     //if (!d3.event.sourceEvent) return; // Only transition after input.
     if (d3.event.sourceEvent && d3.event.sourceEvent.type === "brush") return;
     if (d3.event.sourceEvent && d3.event.sourceEvent.type === "mouseup") {
     console.log("zoomended")
     // interpret as 'small' zoom as a mouseclick to zoom to a ndde
     if (Math.pow((zoomStart.x - d3.mouse(this)[0]),2)<4){
           // Move this to a separate function for re-use in search
           d = getIntersect() // point from raycaster
           if (d) {
            if (!d.children) { d = d.parent}
            console.log("checking", morphDepth, d)
            //if (d.depth < morphDepth){resetInnerRings(morphDepth)}
            morphDepth = d.depth
            console.log("selected", morphDepth, d)
             morphTo(d.x0, d.x1, 0)
         }
        }
     } else {
     //update_mesh(zoom_x)
  }
  };


//--------------------------------------------------------------
// MOUSEOVER - TOOLTIPS ... RAYCASTER INTERSECTIONS etc
// -------------------------------------------------------------


var intersects

function getIntersect() {
   raycaster.setFromCamera( mouse, camera );
   intersects = raycaster.intersectObject( mesh, false )
   intersects_context = raycaster.intersectObject(mesh_context, false )
   intersects_inner = raycaster.intersectObjects( mesh_circles.filter((d)=>d.name!=-1), false )

   if(intersects_inner[0]) { // intersects with inner circle
      d =thelist[intersects_inner[0].object.name]
      return d
   } else if (intersects[0]) { // intersects main_mesh
      d =thelist[face_id[intersects[0].faceIndex]]
      return d
   } else if (intersects_context[0]) { // intersects context view
      d =thelist[face_id[intersects_context[0].faceIndex]]
      return d
   }else {
      return
   }
}

function onMousemove() {
     d = getIntersect()
     if(d){
        set_tooltip(d)
     } else {
        tooltip.style("display","none")
     }
  }

function set_tooltip(d){
   tooltip.style("display","block")
         .style("opacity", 1)
         .style("left", (d3.event.pageX-10) + "px")
         .style("top", (d3.event.pageY + 10) + "px")
   tooltip_head.html(d.data.name)
         .style("background-color", d.color)
   let html_str =
      "<table>"+
      "<tr><td>ID: </td><td>" + d.id+"</td></tr>"+
      "<tr><td>Value: </td><td>" + format_number(d.value) + "</td></tr>"+
      "<tr><td>Depth: </td><td>" + d.depth + "</td></tr>"
      if(d.parent) {
         html_str +=
      "<tr><td>Parent: </td><td>" + d.parent.data.name +"</td><tr>"
         if(d.parent.children){
               html_str += "<tr><td>Siblings:</td><td>" + d.parent.children.length +"</td></tr>"}}
      if(d.children){
         html_str += "<tr><td>Children:</td><td>" + d.children.length +"</td></tr>"}
      html_str += "<tr><td>Range:</td><td>"+formatDecimal(d.x0)+ " - " + formatDecimal(d.x1 )+ "</td></tr>"
      html_str += "</table>"
      tooltip_body.html(html_str)
}

function select_nodes(){
   scene.remove(mesh_highlight)
   //mesh_highlight = make_icicle(selected_nodes, true)
   //mesh_highlight.scale.x = mesh.scale.x
   //mesh_highlight.position.y = mesh.position.y
   //mesh_highlight.position.x = mesh.position.x
   //scene.add(mesh_highlight)
   render()
}

//--------------------------------------------------------------
// NODE SEARCH
// -------------------------------------------------------------


// -------NODE SEARCH --------------
// Add Search Box

d3.select("#searchbox").append("input")
      .attr("class","typeahead tt-query")
      .attr("type","search")
      .attr("placeholder",    "search nodes...")
      .attr("autocomplete","off")
      .attr("spellcheck","false")
      .attr("id", "searchid")

d3.select("#searchbox")
         .append("div")
         .attr("class","reset-query")
         .append("button")
         .attr("class","btn btn-small reset-query arial-lab")
         .attr("id","clearbutton")
         .attr("type", "button")
         .on("click", function(){
           setTimeout(function(){$('.typeahead').typeahead('val', ''); }, 500);
           selected_nodes=[]
           drawLabels()
           zoomTo([0,partition_w])
           d3.select(this).style("display","none")
         })
         .append("span").attr("class","glyphicon glyphicon-remove")
d3.select("#clearbutton").append("text").html(" Clear search query")


var substringMatcher = function(strs) {
  return function findMatches(q, cb) {
    var matches, substringRegex;

    // an array that will be populated with substring matches
    matches = [];

    // regex used to determine if a string contains the substring `q`
    substrRegex = new RegExp(q, 'i');

    // iterate through the pool of strings and for any string that
    // contains the substring `q`, add it to the `matches` array
    $.each(strs, function(i, str) {
      if (substrRegex.test(str)) {
        matches.push(str);
      }
    });

    cb(matches);
  };
};

function doSearch(searchFor) {
      console.log("doSearch", searchFor)
      searchFor = searchFor.toString().toLowerCase()
      selected_nodes = root.descendants().sort(compareByValue).filter(function(d) {
      return d.data.name.toLowerCase()
         .includes(searchFor) || searchFor == ''})
      //if (selected_nodes.length == 0) return;
      select_nodes()
      let zoomrange = [0,0]
      zoomrange[0] = d3.min(selected_nodes, function(d) {
                            return +d.x0;})
      zoomrange[1] = d3.max(selected_nodes, function(d) {
                           return +d.x1;})
      console.log(selected_nodes, zoomrange)
      morphTo(zoomrange[0], zoomrange[1])
};


// use Jquery autocomplete
function updateSearchBox(){

   $(document).ready(function(){
   // Initializing the typeahead
   $('.typeahead').typeahead({
      hint: true,
      highlight: true, /* Enable substring highlighting */
      minLength: 3 /* Specify minimum characters required for showing suggestions */

   },
   {
      name: 'selectedNode',
      limit:10,
      source: substringMatcher(all_labels),
      templates: {
      empty: [
        '<div class="empty-message">  No matching data found!</div>'
     ]}
   });
});
};


var typeaheadItemSelected = false;

$("#searchid").keyup(function (e) {
  if (e.keyCode == 13) {

      //typeaheadItemSelected = true;
      if (this.value == '') {
         this.value = root.data.name
      }
      doSearch(this.value);
      d3.select("#clearbutton").style("display","block")
      $('.typeahead').typeahead('close');

  }
});

$('#searchid').bind('typeahead:change',
 function (e, datum) {
    doSearch(this.value);
});