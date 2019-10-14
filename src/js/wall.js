    'use strict';
    //var iso=["be","bg","cz","dk","de","ee","ie","el","es","fr","hr","it","cy","lv","lt","lu","hu","mt","nl","at","pl","pt","ro","si","sk","fi","se","uk"]
    var graphs = [];
    var summary = {};
    var abbreviations = {};
    var bar={};
    var ndx = null;

var countries = {
  be: "Belgium",
  bg: "Bulgaria",
  cz: "Czech Republic",
  dk: "Denmark",
  de: "Germany",
  ee: "Estonia",
  ie: "Ireland",
  gr: "Greece",
  es: "Spain",
  fr: "France",
  hr: "Croatia",
  it: "Italy",
  cy: "Cyprus",
  lv: "Latvia",
  lt: "Lithuania",
  lu: "Luxembourg",
  hu: "Hungary",
  mt: "Malta",
  nl: "Netherlands",
  at: "Austria",
  pl: "Poland",
  pt: "Portugal",
  ro: "Romania",
  si: "Slovenia",
  sk: "Slovakia",
  fi: "Finland",
  se: "Sweden",
  gb: "United Kingdom"
};

  var formatPercent = d3.format(".0%");

    var formatNumber = function (value) {
       return value > 999 && value < 100000 ? d3.format('.0s')(value) : value >= 100000 ? d3.format('.3s')(value) : value;
    }

    var formatDate = function(d) {
      return d ? d3.time.format("%d/%m/%Y")(d) : ""
    };

    var abbr = function (d) {
      return abbreviations[d] || d;
    };

    var country_color = "#80cbc4";
    var eu_groups = {
      "GUE/NGL": "#800c00",
      "S&D": "#c21200",
      "Verts/ALE": "#05a61e",
      "Greens/EFA": "#05a61e",
      "ALDE": "#ffc200",
      "RE": "#ffc200",
      "EFDD": "#5eced6",
      "PPE": "#0a3e63",
      "EPP": "#0a3e63",
      "ECR": "#3086c2",
      "NA/NI": "#cccccc",
      "NA,NI": "#cccccc",
      "NA": "#cccccc",
      "ENF": "#A1480D",
      "ID": "#A1480D",
      "Array": "pink"
    };


var iconify = function(name, prefix) {
  prefix = prefix || "icon";
  return (
    '<svg class="icon" class="' +
    name +
    '"><title>' +
    name +
    '</title><use href="#' +
    prefix +
    "-" +
    name +
    '" /></svg>'
  );
};

    var data = null, candidates= [];

    function reset() {
      dc.filterAll();
      $("#input-filter").val("").keyup();
      //dc.renderAll()
    };


    function drawGroup(dom) {
      var graph = dc.pieChart(dom).innerRadius(40) //.radius(70);
      var dim = ndx.dimension(function(d) {
        if (typeof d.eugroup == "undefined") return "";
        return d.eugroup;
      });
      var group = dim.group().reduceSum(function(d) {
        return 1;
      });
      graph
        .width(0)
        .height(0)
        .ordering(function(d){return d.key;})
        .colorCalculator(function(d, i) {
          return eu_groups[d.key];
          //return color(d.value.score/d.value.count);
        })
        .dimension(dim)
        .group(group)
        .externalLabels(-26)
        .minAngleForLabel(0.2);
//        .legend(dc.legend().horizontal(true).autoItemWidth(true).y(200));
      return graph;
    }

    function drawSelectCountry(dom) {
      var graph = dc.selectMenu(dom);
      var dim = ndx.dimension(function(d) {
        if (!d.constituency || !d.constituency.country) return "";
        return d.constituency.country;
      });
      var group = dim.group().reduceSum(function(d) {return 1;});
      
      graph
        .dimension(dim)
        .group(group)
        .title (function(d){
          return countries[d.key] +" (" +d.value + " meps)";
        })
        .on('renderlet', function(chart){chart.selectAll('select').classed('form-control input-lg',true);});

      return graph;

    }


    function drawNumbers(graphs) {
      var format = formatNumber;

      var dim = ndx.dimension(function(d) {
        return true;
      });

      var reducer = reductio();

      reducer.value("nb").count(true);


      var group = dim.group();
      reducer(group);

      graphs.total = dc.numberDisplay(".nbmep .nb")
        .group(group)
        .valueAccessor(function(d) {
          return d.value.nb.count
        })
        .formatNumber(formatNumber)
    }



    jQuery(function($) {
      var t=$.urlParam("tweet");
      if (t)
        d3.select("#twitter-tpl").property("value",t);
      $(".btn-toggle-group .btn").click(function(e){
        $(this).addClass("btn-success disabled").removeClass("active");
        var g=graphs[$(this).parent().data("target")];
        g.root().datum($(this).data("sort"));
        if ($(this).data("sort") == "size"){
            g.ordering(function (d) {console.log("by size");return String.fromCharCode(d.value) + d.key});
          } else {
            g.ordering(function (d) {console.log("by az");return d.key});
          }
        g.render();
        $(this).siblings(".btn").removeClass("disabled btn-success").addClass("active");
//        g.redraw();
      });

      $(".btn-toggle").click(function(e) {
        $(this).toggleClass("active");
        $($(this).data("target")).collapse("toggle");
        e.preventDefault();
        e.stopPropagation();
      });
      $(".resetall").click(reset);
      //        $(".summary_total").text(formatNumber(summary.total));
    });


function drawGrid(dom) {
      var dim = ndx.dimension(function(d) {
        return 1
      });

  return dc.dataGrid(dom)
    .dimension(dim)
    .group(function(d){return d.constituency.country})
  .size(1000)
    .html (function(d) { return tpl(d);})
//  .htmlGroup (function (d) { return '<h2>' + d.key + 'with ' + d.values.length +' items</h2>';})
   .htmlGroup (function(d){return "<div class='dc-grid-group'><h3>"+countries[d.key]+"<span class='nbmep badge pull-right'>"+d.values.length+" MEPs</span></h3><div>"})
    .sortBy(function (d) {
        return d.last_name;
        })
  .order(d3.ascending)
  .on('renderlet', function (grid) {
    observer.observe();
    grid.selectAll(".twitter").on("click",function(){
        tweet(d3.select(this.parentNode.parentNode.parentNode).datum());
        });
  });
}

    function tweet(d){
      var t=d3.select("#twitter-tpl").property("value");
      if (t.indexOf("{mep}") !== -1)
        t=t.replace("{mep}","@"+d.Twitter);
      else
        t = ".@"+d.Twitter+" "+t;
      if (d.Twitter) {
        var url="https://twitter.com/intent/tweet?text="+encodeURIComponent(t);
//        url = url.replace(/#/g, '%23');
        var win=window.open(url,'menubar=no,toolbar=no,resizable=yes,scrollbars=yes,height=600,width=600');
      };
    };

      function adjust(data) {
        var dateFormat = d3.time.format("%Y-%m-%d");
        var now = Date.now();

        data.forEach(function(e) {
          e.committee=pluck(e.committees);
          e.delegation=pluck(e.delegations);
          e.role=pluck(e.staff);
          e.phone = e.Addresses.Brussels.Phone;
          if (typeof e.Facebook == "object") e.Facebook = e.Facebook[0];
        });
      }

      function pluck(d) {
        var r=[];
        if (!d) 
          return r;
        d.forEach(function(e){
          if (e.role!="Substitute"){
            r.push(e.name);
          }
        });
        return r;
      }

    function draw(data) {

      adjust(data);
      ndx = crossfilter(data);

      drawNumbers(graphs);
//      graphs.country = drawCountry(".country .panel-body");
      graphs.country = drawSelectCountry(".select-country");
      graphs.group = drawGroup(".group .panel-body");
      graphs.wall = drawGrid("#wall");
      graphs.search = drawTextSearch('#input-filter', jQuery);
      graphs.total.on("postRedraw", function() {setUrl()});
      summary.total = graphs.total.data();
      dc.renderAll();
      $("#input-filter").val($.urlParam("q")).keyup();
    }

    function drawTextSearch(dom, $, val) {

      var dim = ndx.dimension(function(d) {
        return d.first_name.toLowerCase() + " " + d.last_name.toLowerCase() + " " + d.constituency.party.toLowerCase() + " " + d.committee.join(" ").toLowerCase() + " " + d.constituency.country.toLowerCase()
      });

      var throttleTimer;

      $(dom).keyup(function() {

        var s = jQuery(this).val().toLowerCase();
        $(".resetall").attr("disabled", false);
        throttle();

        function throttle() {
          window.clearTimeout(throttleTimer);
          throttleTimer = window.setTimeout(function() {
            dim.filterAll();
            dim.filterFunction(function(d) {
              return d.indexOf(s) !== -1;
            });
            dc.redrawAll();
          }, 250);
        }
      });

      return dim;

    }

    function setUrl(search) {
      //var country=graphs.country.filters();
      search = search || $("#input-filter").val();
      var url = "?";
      if (search) url += "q=" + search + "&";
      window.history.pushState(null, search, url);

    };

    d3.select(window).on('resize.updatedc', function() {
      dc.events.trigger(function() {
        dc.chartRegistry.list().forEach(function(chart) {
          var container = chart.root().node();
          if (!container) return; // some graphs don't have a node (?!)
          container = container.parentNode.getBoundingClientRect();
          chart.width(container.width);
          chart.rescale && chart.rescale(); // some graphs don't have a rescale
        });

        dc.redrawAll();
      }, 500);
    });

    $(function() {
      d3.json("data/meps.json", function(json) {
        data = json;
        draw(data);
      });
      d3.json("data/abbreviations.json", function(json) {
        abbreviations = json;
      });
    });

d3.text("img/eu-flags.svg").mimeType("image/svg+xml").get(function(error, xml) {
  if (error) throw error;
  d3.select("body").append("svg").attr("id","flags").html(xml).classed("d-none",true);
  d3.selectAll("#flags symbol").attr("fill","#000");
  //document.body.appendChild(xml.documentElement);
});


    jQuery.urlParam = function(name) {
      var results = new RegExp('[\?&]' + name + '=([^&#]*)').exec(window.location.href);
      if (results == null) {
        return null;
      } else {
        return decodeURI(results[1]) || 0;
      }
    };

