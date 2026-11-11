# Dust II and Bolluca texture catalog

The runtime recipes are in `src/games/kapsstrike/catalogPbr.json`. The 19 material families use original Poly Haven files, not catalog thumbnails. Each original URL and checksum is recorded in the recipe. Poly Haven licenses the sources under CC0 (https://polyhaven.com/license).

Run `npm run textures:strike` to prepare the assets. The command requires curl and ImageMagick's convert. It verifies the original files before making WebP copies and reuses the generated files on later runs. npm runs this preparation before dev and build. Deploy the complete dist directory so it includes the generated `kapsstrike/catalog-v1` folder.

High uses 4K albedo on selected large surfaces, 2K elsewhere, plus normal and packed AO/roughness/metalness maps. Medium uses separate 1K or 2K catalog selections with the standard shader. Both use mipmaps and share the same collision geometry. Material batches are divided into spatial cells for frustum culling. Small trim on existing crates, vehicles and barrels renders in High only.

Photo frames, labels and intersecting backing solids are excluded from catalog materials. The implementation does not yet include KTX2/Basis, atlas packing, occlusion queries, distance-based LOD or imported model packs.
