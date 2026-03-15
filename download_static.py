import urllib.request
import os

# 定义要下载的文件
files_to_download = [
    ("https://cdn.jsdelivr.net/npm/bootstrap@5.3.2/dist/css/bootstrap.min.css", "css/bootstrap.min.css"),
    ("https://cdn.jsdelivr.net/npm/bootstrap-icons@1.11.1/font/bootstrap-icons.css", "css/bootstrap-icons.min.css"),
    ("https://cdn.jsdelivr.net/npm/bootstrap@5.3.2/dist/js/bootstrap.bundle.min.js", "js/bootstrap.bundle.min.js"),
]

# static 目录
static_dir = os.path.dirname(os.path.abspath(__file__)) + "/static"

# 创建目录
for path in ["css", "js"]:
    dir_path = os.path.join(static_dir, path)
    os.makedirs(dir_path, exist_ok=True)

# 下载文件
for url, dest in files_to_download:
    dest_path = os.path.join(static_dir, dest)
    print(f"Downloading {url} -> {dest_path}")
    try:
        urllib.request.urlretrieve(url, dest_path)
        print(f"✓ Downloaded: {dest_path}")
    except Exception as e:
        print(f"✗ Failed to download {url}: {e}")

print("\nAll downloads complete!")
