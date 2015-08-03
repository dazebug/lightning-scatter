'use strict';
var d3 = require('d3');
var utils = require('lightning-client-utils');
var MultiaxisZoom = require('d3-multiaxis-zoom');
var _ = require('lodash');

var LightningVisualization = require('lightning-visualization');
 
var fs = require('fs');
var css = fs.readFileSync(__dirname + '/style.css');

/*
 * Extend the base visualization object
 */
var Visualization = LightningVisualization.extend({

    getDefaultStyles: function() {
        return {
            color: '#deebfa',
            stroke: '#68a1e5',
            size: 8,
            alpha: 0.9
        }
    },

    getDefaultOptions: function() {
        return {
            brush: true,
            select: true
        }
    },

    init: function() {
        MultiaxisZoom(d3);
        this.margin = {top: 0, right: 0, bottom: 20, left: 45};
        if(_.has(this.data, 'xaxis')) {
            this.margin.bottom = 57;
        }
        if(_.has(this.data, 'yaxis')) {
            this.margin.left = 70;
        }
        this.render();
    },

    css: css,

    render: function() {

        var data = this.data
        var height = this.height
        var width = this.width
        var options = this.options
        var selector = this.selector
        var margin = this.margin
        var self = this

        this.$el = $(selector).first();

        var points = data.points

        var xDomain = d3.extent(points, function(d) {
                return d.x;
            });
        var yDomain = d3.extent(points, function(d) {
                return d.y;
            });

        var xRange = xDomain[1] - xDomain[0]
        var yRange = yDomain[1] - yDomain[0]

        this.x = d3.scale.linear()
            .domain([xDomain[0] - xRange * 0.1, xDomain[1] + xRange * 0.1])
            .range([0, width - margin.left - margin.right]);

        this.y = d3.scale.linear()
            .domain([yDomain[0] - yRange * 0.1, yDomain[1] + yRange * 0.1])
            .range([height - margin.top - margin.bottom, 0]);

        this.zoom = d3.behavior.zoom()
            .x(this.x)
            .y(this.y)
            .on('zoom', zoomed);

        var highlighted = []
        var selected = []

        var container = d3.select(selector)
            .append('div')
            .style('width', width + "px")
            .style('height', height + "px")

        var canvas = container
            .append('canvas')
            .attr('class', 'scatter-plot canvas')
            .attr('width', width - margin.left - margin.right)
            .attr('height', height - margin.top - margin.bottom)
            .style('margin-left', margin.left + 'px')
            .style('margin-right', margin.right + 'px')
            .style('margin-top', margin.top + 'px')
            .style('margin-bottom', margin.bottom + 'px')
            .call(this.zoom)
            .on("dblclick.zoom", null)

        var ctx = canvas.node().getContext("2d")

        var svg = container
            .append('svg:svg')
            .attr('class', 'scatter-plot svg')
            .attr('width', width)
            .attr('height', height)
            .append('svg:g')
            .attr('transform', 'translate(' + margin.left + ',' + margin.top + ')')
            .call(this.zoom)

        svg.append('rect')
            .attr('width', width - margin.left - margin.right)
            .attr('height', height - margin.top - margin.bottom)
            .attr('class', 'scatter-plot rect');

        // setup brushing
        if (options.brush) {

            var shiftKey

            var brush = d3.svg.brush()
                .x(this.x)
                .y(this.y)
                .on("brushstart", function() {
                    // remove any highlighting
                    highlighted = []
                    // select a point if we click without extent
                    var pos = d3.mouse(this)
                    var found = utils.nearestPoint(self.data.points, pos, self.x, self.y)
                    if (found) {
                        if (_.indexOf(selected, found.i) == -1) {
                            selected.push(found.i)
                        } else {
                            _.remove(selected, function(d) {return d == found.i})
                        }
                        redraw();
                    }
                })
                .on("brush", function() {
                    // select points within extent
                    var extent = d3.event.target.extent();
                    if (Math.abs(extent[0][0] - extent[1][0]) > 0 & Math.abs(extent[0][1] - extent[1][1]) > 0) {
                        selected = []
                        _.forEach(points, function(p) {
                            if (_.indexOf(selected, p.i) == -1) {
                                var cond1 = (p.x > extent[0][0] & p.x < extent[1][0])
                                var cond2 = (p.y > extent[0][1] & p.y < extent[1][1])
                                if (cond1 & cond2) {
                                    selected.push(p.i)
                                }
                            }
                        })
                    }
                    redraw();
                })
                .on("brushend", function() {
                    console.log("got user data")
                    getUserData()
                    d3.event.target.clear();
                    d3.select(this).call(d3.event.target);
                })

            var brushrect = container
                .append('svg:svg')
                .attr('class', 'scatter-plot brush-container')
                .attr('width', width + margin.left + margin.right)
                .attr('height', height + margin.top + margin.bottom)
            .append("g")
                .attr('transform', 'translate(' + margin.left + ',' + margin.top + ')')
                .attr('class', 'brush')
                .call(brush)

            d3.selectAll('.brush .background')
                .style('cursor', 'default')
            d3.selectAll('.brush')
                .style('pointer-events', 'none')

            d3.select(selector).on("keydown", function() {
                shiftKey = d3.event.shiftKey;
                if (shiftKey) {
                    d3.selectAll('.brush').style('pointer-events', 'all')
                    d3.selectAll('.brush .background').style('cursor', 'crosshair')
                }
            });

            d3.select(selector).on("keyup", function() {
                if (shiftKey) {
                    d3.selectAll('.brush').style('pointer-events', 'none')
                    d3.selectAll('.brush .background').style('cursor', 'default')
                }
                shiftKey = false
            });

        }

        // setup mouse selections
        if (options.select) {

            function mouseHandler() {
                if (d3.event.defaultPrevented) return;
                var pos = d3.mouse(this)
                var found = utils.nearestPoint(points, pos, self.x, self.y)
                if (found) {
                    highlighted = []
                    highlighted.push(found.i)
                    self.emit('hover', found);
                } else {
                    highlighted = []
                }
                selected = []
                redraw();
            }
            canvas.on("click", mouseHandler)

        }

        var makeXAxis = function () {
            return d3.svg.axis()
                .scale(self.x)
                .orient('bottom')
                .ticks(5);
        };

        var makeYAxis = function () {
            return d3.svg.axis()
                .scale(self.y)
                .orient('left')
                .ticks(5);
        };

        this.xAxis = d3.svg.axis()
            .scale(self.x)
            .orient('bottom')
            .ticks(5);

        svg.append('g')
            .attr('class', 'x axis')
            .attr('transform', 'translate(0, ' + (height - margin.top - margin.bottom) + ')')
            .call(self.xAxis);

        this.yAxis = d3.svg.axis()
            .scale(self.y)
            .orient('left')
            .ticks(5);

        svg.append('g')
            .attr('class', 'y axis')
            .call(self.yAxis);

        svg.append('g')
            .attr('class', 'x grid')
            .attr('transform', 'translate(0,' + (height - margin.top - margin.bottom) + ')')
            .call(makeXAxis()
                    .tickSize(-(height - margin.top - margin.bottom), 0, 0)
                    .tickFormat(''));

        svg.append('g')
            .attr('class', 'y grid')
            .call(makeYAxis()
                    .tickSize(-(width - margin.left - margin.right), 0, 0)
                    .tickFormat(''));

        // automatically set line width based on number of points
        var strokeWidth = points.length > 500 ? 1 : 1.1

        function redraw() {
            ctx.clearRect(0, 0, width + margin.left + margin.right, height + margin.top + margin.bottom)
            draw()
        }

        function draw() {

            var cx, cy;

            _.forEach(self.data.points, function(p) {
                var alpha, stroke, fill;
                if (selected.length > 0) {
                    if (_.indexOf(selected, p.i) >= 0) {
                        alpha = 0.9
                    } else {
                        alpha = 0.1
                    }
                } else {
                    alpha = p.a
                }
                if (_.indexOf(highlighted, p.i) >= 0) {
                    fill = d3.rgb(d3.hsl(p.c).darker(0.75))
                } else {
                    fill = p.c
                }
                cx = self.x(p.x);
                cy = self.y(p.y);
                ctx.beginPath();
                ctx.arc(cx, cy, p.s, 0, 2 * Math.PI, false);
                ctx.fillStyle = utils.buildRGBA(fill, alpha)
                ctx.strokeWidth = strokeWidth
                ctx.strokeStyle = utils.buildRGBA(p.k, alpha)
                ctx.fill()
                ctx.stroke()
            })
              
        }

        function updateAxis() {

            svg.select('.x.axis').call(self.xAxis);
            svg.select('.y.axis').call(self.yAxis);
            svg.select('.x.grid')
                .call(makeXAxis()
                    .tickSize(-(height - margin.top - margin.bottom), 0, 0)
                    .tickFormat(''));
            svg.select('.y.grid')
                .call(makeYAxis()
                        .tickSize(-(width - margin.left - margin.right), 0, 0)
                        .tickFormat(''));

        }

        function zoomed() {

            ctx.clearRect(0, 0, width - margin.left - margin.right, height - margin.top - margin.bottom);
            updateAxis();
            draw();
        }

        if(_.has(this.data, 'xaxis')) {
            var txt = this.data.xaxis;
            if(_.isArray(txt)) {
                txt = txt[0];
            }
            svg.append("text")
                .attr("class", "x label")
                .attr("text-anchor", "middle")
                .attr("x", (width - margin.left - margin.right) / 2)
                .attr("y", height - margin.top)
                .text(txt);
        }
        if(_.has(this.data, 'yaxis')) {
            var txt = this.data.yaxis;
            if(_.isArray(txt)) {
                txt = txt[0];
            }

            svg.append("text")
                .attr("class", "y label")
                .attr("text-anchor", "middle")
                .attr("transform", "rotate(-90)")
                .attr("x", - (height - margin.top - margin.bottom) / 2)
                .attr("y", -margin.left + 20)
                .text(txt);
        }

        d3.select(selector).attr("tabindex", -1)

        function getUserData() {

            utils.sendCommMessage(self, 'selection', selected);
            var x = _.map(selected, function(d) {return points[d].x});
            var y = _.map(selected, function(d) {return points[d].y});
            utils.updateSettings(self, {
                selected: selected,
                x: x,
                y: y
            }, function(err) {
                if(err) {
                    console.log('err saving user data');
                }
            });
        }

        draw();
        
        this.redraw = redraw;

    },

    formatData: function(data) {

        var retColor = utils.getColorFromData(data)
        var retSize = data.size || []
        var retAlpha = data.alpha || []
        var styles = this.styles
        var self = this

        var c, s, a

        data.points = data.points.map(function(d, i) {
            d.x = d[0]
            d.y = d[1]
            d.i = i
            c = retColor.length > 1 ? retColor[i] : retColor[0]
            s = retSize.length > 1 ? retSize[i] : retSize[0]
            a = retAlpha.length > 1 ? retAlpha[i] : retAlpha[0]
            d.c = c ? c : styles.color
            d.s = s ? s : styles.size
            d.k = c ? c.darker(0.75) : styles.stroke 
            d.a = a ? a : styles.alpha
            return d
        })

        return data
    },

    updateData: function(formattedData) {
        this.data = formattedData;
        this.redraw() 
    },

    appendData: function(formattedData) {        
        this.data.points = this.data.points.concat(formattedData.points)
        this.redraw() 
    }

});


module.exports = Visualization;
