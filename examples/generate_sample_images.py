"""
生成示例商品图片

使用 PIL 生成带文字的占位图
"""

from PIL import Image, ImageDraw, ImageFont
import os
from pathlib import Path


def create_placeholder_image(
    filename: str,
    text: str,
    size: tuple = (800, 800),
    bg_color: tuple = (240, 240, 240),
    text_color: tuple = (100, 100, 100)
):
    """创建占位图
    
    Args:
        filename: 文件名
        text: 显示的文字
        size: 图片尺寸
        bg_color: 背景颜色
        text_color: 文字颜色
    """
    # 创建图片
    img = Image.new('RGB', size, bg_color)
    draw = ImageDraw.Draw(img)
    
    # 尝试使用系统字体
    try:
        # Windows
        font = ImageFont.truetype("arial.ttf", 60)
    except:
        try:
            # Linux
            font = ImageFont.truetype("/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf", 60)
        except:
            # 使用默认字体
            font = ImageFont.load_default()
    
    # 计算文字位置（居中）
    bbox = draw.textbbox((0, 0), text, font=font)
    text_width = bbox[2] - bbox[0]
    text_height = bbox[3] - bbox[1]
    
    position = (
        (size[0] - text_width) // 2,
        (size[1] - text_height) // 2
    )
    
    # 绘制文字
    draw.text(position, text, fill=text_color, font=font)
    
    # 绘制边框
    draw.rectangle(
        [(10, 10), (size[0] - 10, size[1] - 10)],
        outline=text_color,
        width=3
    )
    
    # 保存图片
    img.save(filename, 'JPEG', quality=85)
    print(f"✅ 已生成: {filename}")


def main():
    """生成所有示例图片"""
    # 创建 images 目录
    images_dir = Path("examples/images")
    images_dir.mkdir(parents=True, exist_ok=True)
    
    # 定义要生成的图片
    images = [
        ("phone_1.jpg", "iPhone 15\nPro Max", (220, 230, 250)),
        ("phone_2.jpg", "iPhone 15\nBack View", (220, 230, 250)),
        ("laptop_1.jpg", "MacBook Pro\nM2", (230, 230, 230)),
        ("laptop_2.jpg", "MacBook Pro\nKeyboard", (230, 230, 230)),
        ("airpods_1.jpg", "AirPods Pro 2", (250, 250, 250)),
        ("ipad_1.jpg", "iPad Air 5", (240, 245, 250)),
        ("ipad_2.jpg", "iPad Air\nAccessories", (240, 245, 250)),
        ("shoes_1.jpg", "Nike Air Max\n270", (255, 240, 240)),
        ("shoes_2.jpg", "Nike Shoes\nSide View", (255, 240, 240)),
        ("book_1.jpg", "Python\nProgramming", (250, 245, 230)),
        ("band_1.jpg", "Mi Band 8", (245, 245, 245)),
        ("headphone_1.jpg", "Sony\nWH-1000XM4", (240, 240, 250)),
        ("headphone_2.jpg", "Sony Headphone\nCase", (240, 240, 250)),
        ("mouse_1.jpg", "Logitech\nMX Master 3S", (245, 245, 245)),
        ("kindle_1.jpg", "Kindle\nPaperwhite 5", (250, 250, 245)),
        # 额外的通用占位图
        ("product_1.jpg", "Product 1", (240, 240, 240)),
        ("product_2.jpg", "Product 2", (240, 240, 240)),
        ("product_3.jpg", "Product 3", (240, 240, 240)),
    ]
    
    print("🎨 开始生成示例图片...\n")
    
    for filename, text, bg_color in images:
        filepath = images_dir / filename
        create_placeholder_image(
            str(filepath),
            text,
            bg_color=bg_color
        )
    
    print(f"\n✅ 完成！共生成 {len(images)} 张图片")
    print(f"📁 图片位置: {images_dir.absolute()}")


if __name__ == "__main__":
    main()
