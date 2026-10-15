# Skin reference: families, motifs, parameters, emblems, fonts

Read this with `final/prompt.md`. Which motifs are at home in your world comes from the context command (`node final/validate.mjs --context <brief>`), not from this file.

## Families and parameters

Every family draws an all-over, edge-to-edge pattern. Defaults are tuned for the reveal, so start from them. Every family takes slot params; unlisted slot params default sensibly. Strokes are in units of the 100-unit cell. Params ending in `Slot`, and `line`, `edge`, `fill`, `stone`, `plate`, `pocket`, `strand`, `tile`, `brick`, `pattern` and the like, take slot specs; ranges (`0.8-2`) mean numbers. `outline` is always a width (its colour is `edge`) and `dot` always a radius (its colour is `dotSlot`). Families other than `girih` and `rosette` need `params.motif`.

**girih** — interlaced star-and-polygon line patterns. `tiling` 4.8.8 (8-point stars, square) | 6.6.6 (6-point, hex) | 3.12.12 (12-point, hex) | 4.6.12 (12-point with hexagons, hex) | 10.bowtie (10-point, decagonal cell) | 16.4 (16-point, square) | 4.4.4.4 (plain square grid; lattice theme only). `scale` 1-2, `angle` 30-80 (54-72 classic), `delta` 0-0.4 (6.6.6, 4.8.8), `width` 1-4, `outline` 0-1.2, `line`, `edge`, `interlace` bool, `gap` 0.6-1.5, `petals` 0-0.6, `fills` {`star` | `star8` | `star10` | `star12` | `star16` | `star6` | `star4` | `star3`, `petal`, `core`, `rest`, `gap`}, `dots` {at: x | o | tip | inner, r 1-2.5, ro 2-4, slot, n: [sides]}.

**zellij** — bold flat cut-tile compositions in two or three tones (the style of the hand-made reference set the owner loves); square cell. `motif`: `star` n-point stars on a centred lattice, a knocked-out core with a dot, octagon studs between {scale 1-2, n 6 | 8 | 12 | 16, size 0.26-0.36, inner 0.45-0.7, rot, star (slot), knock 0-0.5, knockSlot, core 0-0.2, coreSlot, stud 0-0.1, studSlot, band 0-3 (bands joining the stars along the diagonals), bandSlot}; `burst` rays from a hub to its cell edge, facing rays meet tip to tip, discs on the corners {scale 1-2, n 8 | 12 | 16, width 0.06-0.16, ray (slot), knock 0-0.25, knockSlot, core 0-0.18, coreSlot, disc 0-0.2, discSlot}; `chevron` zigzag bands like carved chevron domes, octagon studs {scale 1-2, bands 1-3, depth 0.3-0.6, band 0.15-0.35, line, band2 (slot of every second row), stud 0-0.08, studs alt | hollow | band | none, studSlot}; `circles` intersecting rings, small rings between, dots where they meet {scale 1-2, stroke 1.5-4, line, small 0-0.3, smallSlot, smallFill, dot 0-5, dotSlot}; `lattice` diagonal bands split by a fine ground line, diamond knots, square studs {scale 1-2, band 4-10, line, split 0-3, splitSlot, knot 0-0.2, knots centre | all, knotSlot, knotLine, knotWidth, stud 0-0.1, studSlot}.

**japanese** — `motif`: `asanoha` {scale 1-2, stroke 1-2, line, facets [6 slots], outline, edge, dots}; `seigaiha` {scale 1-3, rings 2-5, seq, outer 0.8-1, outline, edge, dot, dotSlot}; `shippo` {scale 1-2, lens (slot), core (slot), line, stroke 1-2.5, dot 0.8-2, ring 0-0.6}; `kikko` {scale 1-2, gap 1-2.5, rings 1-3, step 0.12-0.3, seq, inner y | dot | star | flower, innerSlot, stroke, line}; `sayagata` {scale 1-3, stroke 1-3, line, outline, edge, box, boxSize, dot}; `kagome` {scale 1-2, stroke 1.5-4, outline 0-1.2, gap 0.6-1.5, line, edge, interlace bool}.

**rosette** — medallions on a lattice joined by link bands (star rosettes, ray rosettes with dart petals, lens rosettes). `lattice` square | hex, `scale` 1-2, `n` 5-16, `size` 0.6-1, `rings` [{r 0.2-1, w 0.5-2, slot, dash}], `petals` [{shape lens | kite | dart, r0, r1, width, mult, slot, line, lw}], `star` {n, r, inner, slot}, `dots` [{r, mult, size, slot}], `disc` {r, slot}, `knock` {r, slot}, `links` {slot, w 1-3, diag}, `filler` {kind star | dot | diamond | cross | rosette, size, n, inner, slot, dot, dotSlot}.

**tech** — `motif`: `traces` printed-circuit bundles with rounded 45-degree jogs {rows 1-3, lines 2-5, scale 1-2, pitch 0.4-0.8, jog 0.15-0.4, round 0.3-1, stroke 1-2.5, line, vias 0-0.6, viaSlot}; `circuit` calm buses with rounded 45-degree stubs to round pads {scale 1-3, lines 2-4, stroke 1-2.5, line, pad 0.05-0.1, padSlot, holeSlot, vias bool, viaSlot}; `hexcells` honeycomb display, cells lit, ringed or dark in a fixed rhythm {scale 3 | 6, gap 0.8-2, stroke, line, litSlot, ringSlot, coreSlot}; `scan` waveform readout rows: bars above and below a rail {rows 2-4, bars 6-12, width 0.3-0.6, rail 1-2.5, line, railSlot, accent 0-0.3, accentSlot}; `cubes` tumbling blocks {scale 1-3, top, left, right, stroke, line, inset 0.4-0.7}.

**deco** — `motif`: `fan` {scale 1-3, step 0.4-0.7, rings 0-4, seq, ribs 0-24, ribSlot, core 0.15-0.35, coreSlot, outline 0-1.2, edge}; `arch` {scale 1-3, nest 2-5, step, seq, key, sill, rays 0-12, raySlot, offset bool}; `chevron` continuous zigzag bands with a fan of rays rising to the band above {scale 1-2, bands 2-3, band 0.05-0.12, depth 0.15-0.4, seq, fan 7-15, fanSlot, dot}; `sunburst` framed sunray panels, rays stop at the frame {scale 1-3, rays 12-24, rise bool (sun on the sill), brick bool, sun 0.1-0.25, sunSlot, rings 0-3, seq, ray, frame 0.02-0.06, frameSlot}; `ziggurat` stepped chevron bands filling the field {scale 1-2, steps 2-5, bands 3-6, depth 0.3-0.7, seq, line, lineWidth}.

**textile** — `motif`: `quilt` {block lemoyne | ohio | sawtooth | compass, scale 1-2, star, star2, centre, corner, sash, sashSlot, stone, points, quilting}; `weave` {preset houndstooth | shepherd | gingham | pinwheel, colors [2 slots], scale 1-2, thread}; `tartan` {sett [[slot, threads]] 3-7 stripes, symmetric, blend 0.4-0.7, twill 0 | 12-30, twillSlot}; `ikat` {scale 1-2, nest 2-4, seq, rows 14-30, bleed 0-0.6, dot}; `kente` {strips 2-4, blocks 2-4, bars 3-8, barSlots, motif2 ladder | zigzag | checks | diamond, motifSlot, blockSlot, edgeSlot}; `ticking` broad stripe between two narrow ones {scale 2-5, broad 0.1-0.3, narrow 0.03-0.08, gap 0.06-0.2, stripe, thread}.

**fret** — `motif`: `meander` {scale 1-3, alt bool, stroke 0.6-1, line, outline 0-1.2, edge, dot 0.8-2}; `leiwen` thunder fret {scale 2-4 even, turns 2-4, stroke 0.6-1, box, outline, edge}; `knot` interlace {grid 2-6 even, pattern random | chain | rings | lattice | plait, breaks 0.1-0.6, width 0.12-0.26, outline, gap, line, edge}.

**organic** — `motif`: `scroll` {scale 1-2, leaf almond | palmette | acanthus, curl, decay, turns, stem 1-2.5, line, leafSlot, bloom bool, bloomSize, petals, bloomSlot, offset, flip}; `palmette` {scale 1-2, petals 5-11, stem, line, palmSlot, lotusSlot, rowGap}; `whiplash` {scale 1-2, twist, curl, stem, line, leafSlot, bloom, bloomSize, petals, bloomSlot}; `leaftrellis` diagonal stems with alternate leaves {scale 1-3, stem 0.8-2, leaf 0.1-0.2, line, leafSlot, budSlot}.

**heraldic** — `motif`: `foil` lozenge diaper with cusped foils {lobes 3-6, scale 1-2, size, foilSlot, cusp, inner, coreSlot, lineSlot, lineWidth, boss 0-3, bossSlot}; `tracery` touching rings with cusped quatrefoils {scale 1-2, stroke 1-2.5, line, foilSlot, starSlot, boss bool, bossSlot}; `scales` {scale 2-4, step 0.35-0.55, length 0.7-1.1, scaleSlot, edge, innerSlot, rib}; `vair` counterchanged bells, rows interlocking {scale 2-5, tall 0.7-1.2, bellSlot, field, edge}; `seme` charges on a lozenge diaper {scale 1-3, charge fleur | ermine | cross | mullet, size 0.4-0.6, chargeSlot, lineSlot, lineWidth, knot 0-2.5, knotSlot}.

**ancient** — `motif`: `circles` {lattice square | hex, scale 1-3, radius 0.5-1 (square: 0.71 gives lens petals on open ground; hex: 0.5-0.58; larger with filled petals floods the tile with `a`), petal (slot), line (slot), stroke 0.6-2, disc (slot filling each whole circle under the petals: a light slot floods the tile), dot 0.8-2, ring 0-0.6}; `stepfret` {scale 1-3, alt, stroke, block, outline, edge}; `tocapu` square blocks with stepped glyphs {scale 2-4, grout, block, block2, glyph}; `spirals` running spiral, each spiral joined to the next {scale 2-4, turns 1.25-2.5, stroke 1.2-3, line, outline, edge, dot 0-2.5, dotSlot}.

**scifi** — `motif`: `hexarmour` fine chamfered hex plates with a two-tone panel line and corner fasteners {scale 2-5, gap 0.6-2, chamfer 0-0.1, inset 0-0.3, plate, line (the lit upper edges: a light slot such as c/0.6), shade (the rest: a dark slot such as b/0.55), lineWidth 0.4-1, rivets bool, rivetSlot, nodes bool, nodeSlot}; `isogrid` triangular machined pockets, a machined step, bosses with fastener holes {scale 1-3, rib 1-3, fillet 0.1-0.4, pocket, inner, step, boss 0-0.15, bossSlot, ribLine}; `honeycomb` honeycomb core, ribbon walls doubled {scale 3-6, wall 0.8-1.6, line, glue, cell}; `rings` interlaced rings, over-under like chain mail {scale 1-3, radius 0.53-0.68, band 2-4, line, edge, outline 1-2, dot, dotSlot}; `heatshield` tiles in staggered rows, three close tones {scale 3-6, tall 0.7-1, gap 0.6-1.6, round 0.1-0.3, seq}; `solar` cells with cut corners, fingers and busbars {scale 2-4, gap 1-2.5, cut 0.1-0.3, cellSlot, finger, fingers 6-12, busSlot, busbars 2-3}; `geodesic` triangulated struts, subdivided once, hubs {scale 1-3, stroke 1-2.5, line, sub, hubSlot, glaze}; `orbit` rings through the triangle centres of a hex lattice {scale 1-2, radius 0.5-0.8, stroke 1-2.5, line, inner 0-0.35, innerSlot, dot 0-3, dotSlot, fill}; `scangrid` graticule with cross marks {scale 1-3, minor 2-5, stroke, line, minorSlot, minorWidth, mark 0.08-0.25, markSlot, markWidth, ring bool, cells}; `pentagon` pentagonal tiling {scale 1-2, bow 0.25-0.5, fillA, fillB, grout, gap 0.8-2.5, round 0-0.3, dot, dotSlot}.

**chinese** — `motif`: `bingwen` ice-ray window lattice {scale 2-4, jitter 0.5-1, stroke 1.5-3.5, line, pane, blossom 0-1 (blossoms on joints), blossomSlot}; `window` step-by-step brocade lattice {scale 1-2, nest 1-3, stroke 1.5-3.5, line, core}; `coin` cash-coin circles {scale 1-2, stroke, line, petal, hole 0.1-0.25, holeSlot, rimSlot}.

**mashrabiya** — `motif`: `turned` turned-wood lattice screen: spindles with a bead and two collars meeting at knobs, no carving {scale 2-4, diagonal bool (default true), rod 0.04-0.075, bead 0.07-0.13, knob 0.07-0.12, wood, shine (slot or none), knobSlot, knobCore, screen}.

**southasian** — `motif`: `jali` pierced stone screen {scale 1-3, hole star | flower | hex, size 0.3-0.46, small 0-0.14, stone, holeSlot, moulding, mouldWidth}; `ogee` ogival trellis with inlaid flowers {scale 1-3, tall 0.5-1.2, stroke 1.5-3, line, flower 0.12-0.28, flowerSlot, coreSlot, bud bool, budSlot}.

**brick** — `motif`: `hazarbaf` bricks laid to draw a lozenge lattice {form lattice | diamond | zigzag, scale 1-2, bricks 4-10, rows 6-14, band 0.05-0.14, mortar 0.6-1.5, brick, pattern}; `herringbone` {scale 1-2, mortar 0.6-1.5 (a width; its colour is the ground), across, down}; `subway` glazed tile {rows 4-10, cols 2-6, grout, tile, glaze}.

**sectile** — `motif`: `cosmati` roundels linked by inlaid bands, wheels of triangles {scale 1-2, size 0.25-0.36, band 0.03-0.07, n 6-12, wheel, wheel2, line, inlay, field 0-0.2, fieldSlot}.

**baroque** — `motif`: `damask` fleurs in an ogival frame, tone on tone {scale 1-2, tall 0.5-1.2, line, stroke, fleur, rosette}; `trellis` treillage with rosettes {scale 1-3, rail 0.02-0.08, stroke 1-2, line, rosette 0.12-0.3, petals 4-8, rosetteSlot, coreSlot, dot, dotSlot}; `guilloche` engine-turned bands {scale 1-2, bands 1-3, strands 3-7, amp 0.6-1.2, stroke 1-2, line, rule bool, ruleSlot, ruleWidth}.

**victorian** — `motif`: `grille` cast-iron bars, rings and collars {scale 1-2, bar 0.04-0.1, line, ring, inner quatrefoil | cross | none, collar, boss 0-1.6, bossSlot}; `encaustic` floor tile {scale 1-2, corner 0.2-0.35, cornerSlot, ringSlot, star, core, leaf, grout, groutWidth}.

**modern** — `motif`: `constructivist` heavy diagonal bars, light rules, rings {scale 1-2, bar 0.08-0.22, line, lightSlot, ring 0-0.3, ringSlot}; `breeze` pierced concrete screen blocks {scale 1-3, opening circle | petal | diamond, block, holeSlot, rim (slot or none), rimWidth, joint 0-1, jointSlot}; `grid` module grid {scale 1-2, modules 2-4, stroke, line, fineSlot, fineWidth, module}; `memphis` zigzag and half-disc rules {scale 2-4, rows 1-2, stroke, line, halfSlot, tick}.

**african** — generic geometry only, no specific sacred symbols. `motif`: `bogolan` mud-cloth bands {seq [cross | zigzag | dots | ladder], bands 1-3, scale 2-5, stroke 1-2.5, line, dotSlot}; `ndebele` outlined stepped fields {scale 1-2, steps 2-5, outline 0.02-0.05, line, field, bar, lozenge, core}; `stampgrid` comb-drawn grid with a generic stamp {scale 1-3, comb 2-4, stroke, line, stamp diamond | ring | cross, stampSlot, tie bool}.

**steppe** — `motif`: `horn` ram's-horn scrolls on a stem {scale 1-3, curl 0.08-0.16, decay 0.5-0.7, turns 1-1.6, width 0.04-0.1, line, outline, edge, second bool}.

**pacific** — `motif`: `tapa` bark-cloth bands {seq [saw | chevron | lozenge], bands 1-3, scale 2-5, stroke, fill, line, rule}.

**maritime** — `motif`: `net` knotted mesh {scale 1-3, stroke 1.2-2.5, line, knot 1-2.5, knotSlot}; `rope` laid rope rows {rows 1-3, scale 4-10, thick 0.2-0.45, strand, lay, layWidth, cross 0-3, strand2}; `wave` running dog {rows 1-3, spread 1.1-1.8, stroke 1.5-3.5, line, decay, turns}.

**soviet** — late Soviet metro and pavilion ornament (no hammer and sickle in the field: that belongs in the emblem); square cell. `motif`: `coffer` Stalinist coffered ceiling: deep coffers in stepped frames between bold ribs, a rosette or star in each, a boss where the ribs cross {scale 1-3, steps 1-3, rib 0.06-0.16, shape octagon | square, field 0.18-0.32, seq (step slots, outermost first), ribSlot, fieldSlot, centre rosette | star | none, petals 6-12, centreSlot, coreSlot, boss 0-0.08, bossSlot}; `wheat` wheat-and-star lattice: from every star four ears of wheat run along the diagonals to the next stars {scale 1-3, grains 3-6, stem 1-2.5, star 0.1-0.2, corner 0.3-0.7, head 0.5-0.85, spread 20-40, line, grainSlot, starSlot, cornerSlot}.

**tudor** — Tudor and Elizabethan England; square cell. `motif`: `knot` knot garden: a ring in every bed threaded on two diagonals, small rings linking the beds, every crossing over and under {scale 1-2, radius 0.34-0.44, link 0-0.2 (0 drops the links), band 2-4, outline 0.6-1.5, line, edge, pool (slot filling each ring), boss 0-8, bossSlot}; `rose` Tudor rose diaper: a lozenge trellis, a double rose in every lozenge, four-stud knots where the lines cross {scale 1-2, band 1.5-3.5, size 0.2-0.3, knot 0-0.05, line, roseSlot, innerSlot, seedSlot, barbSlot, knotSlot, corner (slot or none: the small quatrefoil between roses)}.

**mongol** — Mongolia; square cell. `motif`: `olzii` endless-knot interlace: square knots whose open corners run into their diagonal neighbours, one endless line {scale 1-2, width 0.16-0.26, outline 0.5-1.2, line, edge, boss 0-4, bossSlot}.

**indus** — Harappan painted ware; square cell. `motif`: `pipal` pipal-leaf lattice: four heart-shaped leaves with drip tips on stalks round every node {scale 1-3, axis bool (leaves along the axes, not the diagonals), length 0.7-0.9, width 0.26-0.44, stalk 1-2.5, node 0.04-0.1, line, leafSlot, vein (slot or none), veinWidth, nodeSlot, dot 0-3, dotSlot}; `scales` checker-scale: overlapping scale rows, filled and hollow scales alternating like a checkerboard, each with an inner ring {scale 2-6, step 0.8-1.2, outline 1-2.5, inner 0-0.65, ring 1.5-3, fill, fill2, ringSlot, ring2, edge, dot 0-3}.

**sasanian** — Sasanian Iran, Byzantium and the early Islamic (Umayyad) world; square cell. `motif`: `roundel` pearl roundels: a pearl-bordered ring round a rosette or star, clasped to its neighbours, a four-petal filler between {scale 1-2, size 0.42-0.49, band 0.14-0.22, pearls 12-24, pearl 0.22-0.36, centre rosette | star | none, petals 6-12, ringSlot, fieldSlot, pearlSlot, centreSlot, coreSlot, claspSlot, filler (slot or none)}; `interlace` interlaced circles (Umayyad window grilles, Coptic and Byzantine carving): every ring crosses its four neighbours over and under {scale 1-2, radius 0.55-0.66, band 2-4, outline 0.6-1.5, line, edge, pool, centre rosette | dot | none, centreSize 0.12-0.26, petals 5-10, centreSlot, coreSlot, stud 0-0.1, studSlot}.

**louis** — Louis XVI neoclassical France; square cell. `motif`: `guilloche` rows of guilloche: two bands wind round a row of eyes and cross between them over and under, a rosette in every eye {scale 1-2, open 0-1, band 2-4, outline 0.6-1.5, rule 0-3.5 (fillet between rows; 0 drops it), gap 2-8, eye 0.45-0.75, petals 6-10, line, edge, eyeSlot, coreSlot, ruleSlot}; `fleur` fleur-de-lis on a lozenge trellis with a patera where the lines cross {scale 1-2, size 0.32-0.46, band 1.5-3.5, patera 0-0.1, petals 6-10, corner fleur | none, line, fleurSlot, cornerSlot, pateraSlot, coreSlot}.

**paleo** — Upper Palaeolithic engraving and ochre, geometric only; square cell. `motif`: `chevron` incised chevron bands with rows of drilled pits; with 3 lines the middle groove takes the light slot {scale 1-3, rows 1-3, lines 1-3, stroke 1.5-3.5, depth 0.25-0.6, spacing 0.1-0.25, alt bool, dot 0-3.5, line, midSlot, dotSlot}; `ochre` ochre lattice: rails bounding bands of cross-hatched lozenges, an ochre dot in each {scale 1-3, rows 1-3, stroke 1.5-3.5, dot 0-4.5, alt bool, rail bool, pits bool, line, dotSlot}.

## Presence: line-only tiles

A tile drawn only in lines (interlace, outline, fine fret or lattice, no fills) looks faint when it is small. The validator measures it at three sizes and fails it when it is too faint:
- 48 px medallion: at least 15% of the medallion is motif and its mean lightness is at least 7 L* away from the ground. When the mean is under 9 L* (a line-only tile), the lines must also be at least 0.85 px wide.
- card strip (54 px tall): at least 14% motif, mean lightness at least 6.4 L* away from the ground.
- flash (240 px per motif): at least 12% motif, mean lightness at least 6 L* away from the ground.

So a line-only tile needs a bolder stroke and a stronger ink colour. At the medallion 1.5 motif repeats fill 48 px, so a line `width` in cell units shows at about width x 48 / (150 / scale) px. Measured at `scale` 1: girih 4.8.8 interlace passes from `width` 2.8 in gold `a` 53 L* off the ground, but needs 3.6 in blue 41 L* off the ground; the sparser girih 6.6.6 interlace needs 3.4 or more in gold and fails at every width in that blue. Put `a` at least 50 L* away from `b`, or put the light slot `c` on the lines. If the mood must stay sparse, keep the lines bold and the spacing open; do not make the lines thin.

## Tiers

**Hero** motifs (the intricate, high-craft ones a house is built from; layer 1 of every house ideology must be one): girih 4.8.8, 6.6.6, 3.12.12, 4.6.12, 10.bowtie, 16.4; zellij star, burst, chevron, circles, lattice; japanese asanoha, seigaiha, shippo, kikko, sayagata, kagome; tech circuit, cubes; deco fan, chevron, sunburst; textile quilt; fret meander, leiwen, knot; heraldic tracery, scales, vair; ancient circles, stepfret, spirals; scifi hexarmour, isogrid, honeycomb, rings, heatshield, solar, geodesic; chinese window, coin; southasian jali; sectile cosmati; maritime wave; soviet coffer, wheat; tudor knot, rose; mongol olzii; indus pipal, scales; sasanian roundel, interlace; louis guilloche, fleur; paleo chevron, ochre.
Every other motif is **support**: an accent layer only.

## Emblem kinds

`star` {n 4-12, k 1-4, inner 0.2-0.6, rot}, `crescent` {rot, star: bool}, `crescentcross` (crescent embracing a cross), `cross` {style: greek | latin | coptic, bar 0.2-0.4}, `wheel` {n 6-12, knobs: bool}, `laurel` {n 4-8, inner: {kind, size}}, `gear` {n 8-16}, `sun` {n 8-16}, `rays` {n 8-16}, `wheat` {n: 1 | 3}, `globe`, `orbit`, `cap` (the pileus, a liberty cap), `tomoe` (three comma swirls), `torii` (a shrine gate), `lotus`, `palm`, `clock`, `column`, `coin`, `anchor`, `crown`, `sword`, `shield`, `book`, `scales`, `flame`, `eye`, `tower`, `ship`, or `none`.
Common params: `slot` (glyph, default `c`), `ring` (slot or `"none"`), `ringWidth` 0.6-2, `pad` 0.15-0.4, `ground` (disc slot, default `b`). The engine sizes the mark.

## Font pairs

Copy the display and body names exactly.
- `inscribed`: Cinzel + Hanken Grotesk; antiquity, empires, senates, classical republics
- `hellenic`: Marcellus + Noto Sans; bronze-age and classical courts, myth
- `blackletter`: Pirata One + Source Serif 4; medieval and feudal worlds, knights, crowns, dragons
- `earlyprint`: IM Fell English SC + Public Sans; 1500-1750: early modern courts, sail, piracy, colonies
- `didone`: Bodoni Moda + Hanken Grotesk; 1750-1900 courts, revolutions, nineteenth-century states
- `victorian`: Old Standard TT + Noto Sans (both Cyrillic); 1850-1920 empires, industrial modernisation
- `poster`: Oswald + PT Serif (both Cyrillic); twentieth-century mass politics, socialist states, Cyrillic worlds
- `naskh`: El Messiri + Source Serif 4; Arabic-script worlds before the modern state
- `kufi`: Reem Kufi + Hanken Grotesk; modern Arabic-script states, revolutions, oil-state modernity
- `mincho`: Shippori Mincho + Noto Sans JP; kana and kanji worlds of any era
- `hanzi`: ZCOOL XiaoWei + Noto Sans SC; hanzi worlds and their neighbours
- `deco`: Limelight + Hanken Grotesk; 1920-1945, jazz-age cities, interwar regimes
- `civic`: Public Sans + Source Serif 4; modern democracies, parliaments, the present day
- `severe`: Anton + Source Serif 4; authoritarian, militarised or austere states
- `techno`: Chakra Petch + Noto Sans; near future, colonies, space stations, machines
- `orbital`: Michroma + IBM Plex Sans (+ Share Tech Mono); far future, interstellar states, machine and post-human worlds
- `typewriter`: Special Elite + Hanken Grotesk; collapse, dystopia, survival, bureaucratic horror
- `rounded`: Fredoka + Noto Sans; absurd, comic or toy worlds (talking objects, animals)
