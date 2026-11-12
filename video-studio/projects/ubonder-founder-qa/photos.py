"""Clean the technician photos: blur other businesses' names/phone numbers printed on shirts, crop a location watermark."""
from PIL import Image, ImageFilter
from pathlib import Path
A = Path(__file__).resolve().parent / "assets"
BLUR = {2: [(620, 770, 859, 960)], 5: [(2170, 1940, 2500, 2220), (3010, 2100, 3320, 2340)], 6: [(1860, 1540, 2340, 1920)], 3: [(860, 1230, 1108, 1340)]}
CROP = {3: (0, 0, 1108, 1340)}   # drop the camera/location watermark at the bottom
for i in range(1, 9):
    im = Image.open(A / f"p{i}.jpg").convert("RGB")
    if i in CROP: im = im.crop(CROP[i])
    for box in BLUR.get(i, []):
        im.paste(im.crop(box).filter(ImageFilter.GaussianBlur(18)), box[:2])
    im.save(A / f"ph{i}.jpg", quality=92)
    print(i, im.size)
