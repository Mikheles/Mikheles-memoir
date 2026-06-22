(function(){
  "use strict";
  var DATA = window.MEMOIR || {chapters:[],documents:[]};
  var DOCS = DATA.documents || [];

  // ---- helpers ----
  function el(tag, cls, html){var e=document.createElement(tag);if(cls)e.className=cls;if(html!=null)e.innerHTML=html;return e;}
  function $(s){return document.querySelector(s);}
  function $all(s){return Array.prototype.slice.call(document.querySelectorAll(s));}

  // map "עמ' NN" reference -> document index for clickable links
  var refToDoc = {};
  DOCS.forEach(function(d,i){ if(d.ref) refToDoc[d.ref.replace(/\s+/g,' ').trim()] = i; });

  // turn a paragraph into HTML: page markers + doc references
  function renderParagraph(text, dropCap){
    // page marker at start like (44) or (183)
    var marker = "";
    var rest = text.replace(/^\((\d{1,3})\)\s*/, function(_,n){
      marker = '<span class="pagemark">עמ\' '+n+'</span>';
      return '';
    });
    // drop-cap: wrap the first letter of the actual text
    if(dropCap){
      rest = rest.replace(/^(\s*)(\S)/, function(_, sp, ch){
        return sp + '<span class="dropcap">' + ch + '</span>';
      });
    }
    var html = marker + rest;
    // footnote marker
    html = html.replace(/\[\^1\]/g,'<sup>1</sup>');
    // doc references: "ראה עמ' NN" / "(ראה עמ' NN" / "עמ' NN"
    html = html.replace(/(ראה\s+)?עמ['׳]\s*(\d{1,3})/g, function(m, see, n){
      var key = "עמ' "+n;
      if(refToDoc[key]!=null){
        return (see||'')+'<span class="docref" data-doc="'+refToDoc[key]+'">עמ\' '+n+'</span>';
      }
      return m;
    });
    return html;
  }

  // =================== READER ===================
  var MS_DIR = "assets/manuscript/";
  var viewMode = "he";  // "he" | "ru" | "both"

  function msImages(c){ return c.ms_pages || []; }

  // Hebrew column for a chapter
  function heColumn(c){
    var wrap = el("div","col col-he");
    var paras = c.paras||[];
    paras.forEach(function(p, idx){
      var node = el("p",null,renderParagraph(p, false));
      if(idx===0) node.className = "first-para";
      wrap.appendChild(node);
    });
    if(!paras.length){
      wrap.appendChild(el("p","muted","(אין טקסט בפרק זה)"));
    }
    return wrap;
  }

  // Russian manuscript column for a chapter
  function ruColumn(c){
    var wrap = el("div","col col-ru");
    var imgs = msImages(c);
    if(!imgs.length){
      wrap.appendChild(el("p","muted","(אין סריקות לפרק זה)"));
      return wrap;
    }
    imgs.forEach(function(im){
      var fig = el("figure","ms-page");
      var img = el("img");
      img.loading = "lazy";
      img.src = MS_DIR + im.file;
      img.alt = "כתב יד מקורי, עמ' " + im.page;
      img.dataset.page = im.page;
      img.addEventListener("click",function(){ openMsLightbox(im); });
      fig.appendChild(img);
      fig.appendChild(el("figcaption",null,"עמ' " + im.page));
      wrap.appendChild(fig);
    });
    return wrap;
  }

  function buildReader(){
    var toc = $("#toc"), reader = $("#reader");
    if(!toc||!reader) return;
    toc.innerHTML=""; reader.innerHTML="";

    var groups = [
      {part:"grandpa", title:"זיכרונות הסבא"},
      {part:"maria", title:"אמא מריה — תולדות משפחתה"},
      {part:"appendix", title:"נספחים ומסמכים"}
    ];

    groups.forEach(function(g){
      var chs = DATA.chapters.filter(function(c){return c.part===g.part;});
      if(!chs.length) return;

      var tg = el("div","toc-group");
      tg.appendChild(el("div","toc-group-title",g.title));
      toc.appendChild(tg);

      if(g.part==="maria"||g.part==="appendix"){
        reader.appendChild(el("div","part-divider",g.title));
      }

      chs.forEach(function(c){
        var a = el("a",null,c.title);
        a.href = "#read";
        a.dataset.ch = c.id;
        a.addEventListener("click",function(ev){
          ev.preventDefault();
          var t = document.getElementById("ch-"+c.id);
          if(t) t.scrollIntoView({behavior:"smooth",block:"start"});
          // collapse TOC on mobile after selecting
          var toc = document.getElementById("toc");
          var tt = document.getElementById("tocToggle");
          if(toc) toc.classList.remove("open");
          if(tt){ tt.classList.remove("open"); tt.setAttribute("aria-expanded","false"); }
        });
        tg.appendChild(a);

        var sec = el("section","chapter");
        sec.id = "ch-"+c.id;
        sec.appendChild(el("div","chapter-eyebrow",g.title));
        sec.appendChild(el("h3",null,c.title));

        var body = el("div","chapter-body");
        body.appendChild(heColumn(c));
        body.appendChild(ruColumn(c));
        sec.appendChild(body);

        reader.appendChild(sec);
      });
    });

    reader.addEventListener("click",function(ev){
      var t = ev.target.closest(".docref");
      if(t){ openLightbox(parseInt(t.dataset.doc,10)); }
    });

    applyViewMode();
    setupScrollSpy();
  }

  function applyViewMode(){
    var reader = $("#reader");
    if(!reader) return;
    reader.classList.remove("mode-he","mode-ru","mode-both");
    reader.classList.add("mode-" + viewMode);
    $all(".mode-btn").forEach(function(b){
      b.classList.toggle("active", b.dataset.mode===viewMode);
    });
  }

  function initViewToggle(){
    $all(".mode-btn").forEach(function(b){
      b.addEventListener("click",function(){
        viewMode = b.dataset.mode;
        applyViewMode();
      });
    });
  }

  function setupScrollSpy(){
    var links = $all("#toc a");
    var map = {};
    links.forEach(function(a){ map[a.dataset.ch]=a; });
    var obs = new IntersectionObserver(function(entries){
      entries.forEach(function(en){
        if(en.isIntersecting){
          var id = en.target.id.replace("ch-","");
          links.forEach(function(a){a.classList.remove("active");});
          if(map[id]) map[id].classList.add("active");
        }
      });
    },{rootMargin:"-20% 0px -70% 0px"});
    $all(".chapter").forEach(function(s){obs.observe(s);});
  }

  // =================== DOCUMENTS ===================
  function buildDocs(){
    var grid = $("#docGrid");
    if(!grid) return;
    grid.innerHTML="";
    DOCS.forEach(function(d,i){
      var card = el("div","doc-card");
      var thumb = el("div","doc-thumb");
      var img = el("img"); img.src="assets/docs/"+d.file; img.alt=d.caption; img.loading="lazy";
      thumb.appendChild(img);
      var meta = el("div","doc-meta");
      meta.appendChild(el("div","doc-cap",d.caption));
      if(d.ref) meta.appendChild(el("div","doc-ref",d.ref));
      card.appendChild(thumb); card.appendChild(meta);
      card.addEventListener("click",function(){openLightbox(i);});
      grid.appendChild(card);
    });
  }

  // =================== LIGHTBOX ===================
  function openLightbox(i){
    var d = DOCS[i]; if(!d) return;
    $("#lbImg").src = "assets/docs/"+d.file;
    $("#lbImg").alt = d.caption;
    $("#lbCap").textContent = d.caption + (d.ref? "  ·  "+d.ref : "");
    $("#lightbox").classList.add("show");
  }
  function openMsLightbox(im){
    $("#lbImg").src = MS_DIR + im.file;
    $("#lbImg").alt = "כתב יד מקורי, עמ' " + im.page;
    $("#lbCap").textContent = "כתב היד המקורי · עמ' " + im.page;
    $("#lightbox").classList.add("show");
  }
  function closeLightbox(){ $("#lightbox").classList.remove("show"); $("#lbImg").src=""; }

  // =================== TREE ===================
  function buildTree(){
    var root = $("#tree"); if(!root||!window.FAMILY_TREE) return;
    root.innerHTML="";
    var gens = window.FAMILY_TREE.generations;
    gens.forEach(function(g,gi){
      var lab = el("div","gen-label",g.label); root.appendChild(lab);
      var row = el("div","gen");
      g.items.forEach(function(item){
        if(item.type==="couple"){
          var couple = el("div","couple");
          var n1 = personNode(item.people[0]);
          var link = el("div","link");
          var n2 = personNode(item.people[1]);
          n2.classList.add("spouse");
          couple.appendChild(n1); couple.appendChild(link); couple.appendChild(n2);
          row.appendChild(couple);
        } else {
          row.appendChild(personNode(item.people[0]));
        }
      });
      root.appendChild(row);
      if(gi<gens.length-1) root.appendChild(el("div","connector"));
    });
    initTreeZoom();
  }

  var treeScale = 1;
  function applyTreeScale(){
    var t = $("#tree");
    if(t) t.style.transform = "scale(" + treeScale + ")";
  }
  function initTreeZoom(){
    // On small screens, start zoomed out so the whole tree fits.
    var scroll = document.querySelector(".tree-scroll");
    if(scroll && window.innerWidth < 760){
      treeScale = Math.max(0.5, Math.min(1, (window.innerWidth - 32) / 760));
    } else {
      treeScale = 1;
    }
    applyTreeScale();
    var zin = $("#treeZoomIn"), zout = $("#treeZoomOut"), zres = $("#treeZoomReset");
    if(zin) zin.onclick = function(){ treeScale = Math.min(1.6, treeScale + 0.15); applyTreeScale(); };
    if(zout) zout.onclick = function(){ treeScale = Math.max(0.4, treeScale - 0.15); applyTreeScale(); };
    if(zres) zres.onclick = function(){ initTreeZoom(); };
  }
  function personNode(p){
    var n = el("div","node");
    n.appendChild(el("div","node-name",p.name));
    if(p.years) n.appendChild(el("div","node-years",p.years));
    if(p.note) n.appendChild(el("div","node-note",p.note));
    n.addEventListener("click",function(){showPerson(p);});
    return n;
  }
  function showPerson(p){
    var panel = $("#personPanel");
    panel.innerHTML="";
    panel.appendChild(el("h4",null,p.name));
    panel.appendChild(el("div","py",[p.years,p.note].filter(Boolean).join("  ·  ")));
    panel.appendChild(el("div","pd",p.desc||""));
    panel.classList.add("show");
    panel.scrollIntoView({behavior:"smooth",block:"nearest"});
  }

  // =================== TIMELINE ===================
  function buildTimeline(){
    var root = $("#timeline"); if(!root||!window.TIMELINE) return;
    root.innerHTML="";
    window.TIMELINE.forEach(function(t){
      var item = el("div","tl-item");
      item.appendChild(el("div","tl-year",t.year));
      item.appendChild(el("div","tl-dot"));
      var body = el("div","tl-body");
      if(t.tag) body.appendChild(el("span","tl-tag",t.tag));
      body.appendChild(el("div","tl-title",t.title));
      if(t.desc) body.appendChild(el("div","tl-desc",t.desc));
      item.appendChild(body);
      root.appendChild(item);
    });
  }

  // =================== ROUTER ===================
  function showPage(hash){
    var id = (hash||"#home").replace("#","");
    var valid = ["home","read","documents","tree","timeline"];
    if(valid.indexOf(id)<0) id="home";
    $all(".page").forEach(function(p){p.classList.remove("active");});
    var pg = document.getElementById("page-"+id);
    if(pg) pg.classList.add("active");
    $all(".topnav a").forEach(function(a){
      a.classList.toggle("active", a.getAttribute("href")==="#"+id);
    });
    window.scrollTo({top:0});
    $("#menuToggle") && $(".topnav").classList.remove("open");
  }

  function initNav(){
    $all("[data-nav]").forEach(function(a){
      a.addEventListener("click",function(ev){
        var h = a.getAttribute("href");
        if(h && h.charAt(0)==="#"){ ev.preventDefault(); location.hash=h; }
      });
    });
    window.addEventListener("hashchange",function(){showPage(location.hash);});
    var mt = $("#menuToggle");
    if(mt) mt.addEventListener("click",function(){$(".topnav").classList.toggle("open");});
    var tt = $("#tocToggle");
    if(tt) tt.addEventListener("click",function(){
      var toc = $("#toc");
      var open = toc.classList.toggle("open");
      tt.classList.toggle("open", open);
      tt.setAttribute("aria-expanded", open ? "true" : "false");
    });
    $("#lbClose").addEventListener("click",closeLightbox);
    $("#lightbox").addEventListener("click",function(ev){ if(ev.target===this) closeLightbox(); });
    document.addEventListener("keydown",function(ev){ if(ev.key==="Escape") closeLightbox(); });
  }

  // =================== HOME STRIP ===================
  function buildStrip(){
    var row = document.getElementById("stripRow");
    if(!row) return;
    row.innerHTML="";
    // Use the first 4 document scans as an archive preview.
    // (Swap DOCS for a dedicated family-photos list once those are added.)
    DOCS.slice(0,4).forEach(function(d,i){
      var item = el("div","strip-item");
      var img = el("img");
      img.src = "assets/docs/"+d.file;
      img.alt = d.caption;
      img.loading = "lazy";
      item.appendChild(img);
      item.addEventListener("click",function(){ openLightbox(i); });
      row.appendChild(item);
    });
  }

  // ---- boot ----
  buildReader();
  initViewToggle();
  buildDocs();
  buildStrip();
  buildTree();
  buildTimeline();
  initNav();
  showPage(location.hash);
})();
