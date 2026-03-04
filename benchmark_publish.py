"""
闲鱼商品发布性能测试脚本

测试批量发布性能，记录耗时和成功率
"""

import asyncio
import time
import csv
import json
from pathlib import Path
from datetime import datetime
from typing import List, Dict, Any
from product_publisher import XianyuProductPublisher, ProductInfo
from loguru import logger


class PublishBenchmark:
    """发布性能测试器"""
    
    def __init__(self, cookie_id: str, cookies_str: str, headless: bool = True):
        self.cookie_id = cookie_id
        self.cookies_str = cookies_str
        self.headless = headless
        self.results: List[Dict[str, Any]] = []
    
    async def benchmark_single_publish(
        self,
        product: ProductInfo,
        run_id: int
    ) -> Dict[str, Any]:
        """测试单个商品发布性能
        
        Args:
            product: 商品信息
            run_id: 运行编号
        
        Returns:
            性能数据字典
        """
        logger.info(f"\n{'='*60}")
        logger.info(f"🏃 运行 #{run_id}: {product.title}")
        logger.info(f"{'='*60}")
        
        # 创建发布器
        publisher = XianyuProductPublisher(
            cookie_id=self.cookie_id,
            cookies_str=self.cookies_str,
            headless=self.headless
        )
        
        result = {
            "run_id": run_id,
            "title": product.title,
            "price": product.price,
            "image_count": len(product.images),
            "start_time": None,
            "end_time": None,
            "duration": None,
            "success": False,
            "error": None
        }
        
        try:
            # 记录开始时间
            start_time = time.time()
            result["start_time"] = datetime.now().isoformat()
            
            # 初始化浏览器
            await publisher.init_browser()
            
            # Cookie 登录
            login_success = await publisher.login_with_cookie()
            if not login_success:
                raise Exception("Cookie 登录失败")
            
            # 发布商品
            publish_success = await publisher.publish_product(product)
            
            # 记录结束时间
            end_time = time.time()
            result["end_time"] = datetime.now().isoformat()
            result["duration"] = end_time - start_time
            result["success"] = publish_success
            
            if publish_success:
                logger.success(f"✅ 发布成功，耗时: {result['duration']:.2f} 秒")
            else:
                logger.error(f"❌ 发布失败，耗时: {result['duration']:.2f} 秒")
        
        except Exception as e:
            end_time = time.time()
            result["end_time"] = datetime.now().isoformat()
            result["duration"] = end_time - start_time if result["start_time"] else 0
            result["success"] = False
            result["error"] = str(e)
            logger.error(f"❌ 发布出错: {e}")
        
        finally:
            await publisher.close()
        
        self.results.append(result)
        return result

    async def benchmark_batch_publish(
        self,
        products: List[ProductInfo],
        batch_size: int = 5
    ) -> Dict[str, Any]:
        """测试批量发布性能
        
        Args:
            products: 商品列表
            batch_size: 每批数量
        
        Returns:
            性能统计数据
        """
        logger.info(f"\n{'='*60}")
        logger.info(f"📦 批量发布性能测试")
        logger.info(f"总商品数: {len(products)}")
        logger.info(f"批次大小: {batch_size}")
        logger.info(f"{'='*60}")
        
        start_time = time.time()
        
        # 分批发布
        for i in range(0, len(products), batch_size):
            batch = products[i:i+batch_size]
            logger.info(f"\n📤 发布批次 {i//batch_size + 1}")
            
            for j, product in enumerate(batch):
                await self.benchmark_single_publish(product, i + j + 1)
                
                # 批次间延迟
                if j < len(batch) - 1:
                    delay = 10  # 10 秒延迟
                    logger.info(f"⏳ 等待 {delay} 秒...")
                    await asyncio.sleep(delay)
        
        end_time = time.time()
        total_duration = end_time - start_time
        
        # 统计结果
        stats = self.generate_stats(total_duration)
        
        return stats
    
    def generate_stats(self, total_duration: float) -> Dict[str, Any]:
        """生成统计报告
        
        Args:
            total_duration: 总耗时
        
        Returns:
            统计数据
        """
        total = len(self.results)
        success = sum(1 for r in self.results if r["success"])
        failed = total - success
        
        durations = [r["duration"] for r in self.results if r["duration"]]
        avg_duration = sum(durations) / len(durations) if durations else 0
        min_duration = min(durations) if durations else 0
        max_duration = max(durations) if durations else 0
        
        stats = {
            "total_runs": total,
            "success_count": success,
            "failed_count": failed,
            "success_rate": (success / total * 100) if total > 0 else 0,
            "total_duration": total_duration,
            "avg_duration_per_product": avg_duration,
            "min_duration": min_duration,
            "max_duration": max_duration,
            "throughput": total / total_duration if total_duration > 0 else 0
        }
        
        return stats
    
    def print_report(self, stats: Dict[str, Any]):
        """打印性能报告
        
        Args:
            stats: 统计数据
        """
        logger.info(f"\n{'='*60}")
        logger.info("📊 性能测试报告")
        logger.info(f"{'='*60}")
        
        logger.info(f"\n📈 总体统计:")
        logger.info(f"  总运行次数: {stats['total_runs']}")
        logger.info(f"  成功次数: {stats['success_count']}")
        logger.info(f"  失败次数: {stats['failed_count']}")
        logger.info(f"  成功率: {stats['success_rate']:.2f}%")
        
        logger.info(f"\n⏱️  耗时统计:")
        logger.info(f"  总耗时: {stats['total_duration']:.2f} 秒")
        logger.info(f"  平均耗时: {stats['avg_duration_per_product']:.2f} 秒/商品")
        logger.info(f"  最快: {stats['min_duration']:.2f} 秒")
        logger.info(f"  最慢: {stats['max_duration']:.2f} 秒")
        logger.info(f"  吞吐量: {stats['throughput']:.2f} 商品/秒")
        
        logger.info(f"\n{'='*60}")
    
    def save_results(self, output_file: str = "benchmark_results.json"):
        """保存测试结果到文件
        
        Args:
            output_file: 输出文件路径
        """
        output_path = Path(output_file)
        
        # 保存 JSON 格式
        with open(output_path, 'w', encoding='utf-8') as f:
            json.dump(self.results, f, indent=2, ensure_ascii=False)
        
        logger.info(f"\n💾 结果已保存到: {output_path.absolute()}")
        
        # 保存 CSV 格式
        csv_path = output_path.with_suffix('.csv')
        with open(csv_path, 'w', newline='', encoding='utf-8') as f:
            if self.results:
                writer = csv.DictWriter(f, fieldnames=self.results[0].keys())
                writer.writeheader()
                writer.writerows(self.results)
        
        logger.info(f"💾 CSV 已保存到: {csv_path.absolute()}")


async def load_products_from_csv(csv_file: str) -> List[ProductInfo]:
    """从 CSV 文件加载商品
    
    Args:
        csv_file: CSV 文件路径
    
    Returns:
        商品列表
    """
    products = []
    
    with open(csv_file, 'r', encoding='utf-8') as f:
        reader = csv.DictReader(f)
        for row in reader:
            # 解析图片路径
            images = row['images'].split('|') if row.get('images') else []
            
            product = ProductInfo(
                title=row['title'],
                description=row['description'],
                price=float(row['price']),
                images=images,
                category=row.get('category'),
                location=row.get('location'),
                original_price=float(row['original_price']) if row.get('original_price') else None,
                stock=int(row.get('stock', 1))
            )
            products.append(product)
    
    return products


async def main():
    """主函数"""
    import argparse
    import os
    
    parser = argparse.ArgumentParser(
        description="闲鱼商品发布性能测试",
        formatter_class=argparse.RawDescriptionHelpFormatter
    )
    
    parser.add_argument(
        "--cookie-id",
        required=True,
        help="账号ID"
    )
    
    parser.add_argument(
        "--cookie",
        default=None,
        help="Cookie 字符串（如果不提供，将从环境变量 XIANYU_COOKIE 读取）"
    )
    
    parser.add_argument(
        "--csv",
        default="examples/products_sample.csv",
        help="商品 CSV 文件路径"
    )
    
    parser.add_argument(
        "--batch-size",
        type=int,
        default=5,
        help="每批发布数量"
    )
    
    parser.add_argument(
        "--output",
        default="benchmark_results.json",
        help="结果输出文件"
    )
    
    parser.add_argument(
        "--no-headless",
        action="store_true",
        help="非无头模式"
    )
    
    args = parser.parse_args()
    
    # 获取 Cookie
    cookies_str = args.cookie
    if cookies_str is None:
        cookies_str = os.getenv("XIANYU_COOKIE")
        if cookies_str is None:
            logger.error("❌ 未提供 Cookie")
            return
    
    # 加载商品
    logger.info(f"📂 加载商品数据: {args.csv}")
    products = await load_products_from_csv(args.csv)
    logger.info(f"✅ 已加载 {len(products)} 个商品")
    
    # 创建测试器
    benchmark = PublishBenchmark(
        cookie_id=args.cookie_id,
        cookies_str=cookies_str,
        headless=not args.no_headless
    )
    
    # 运行测试
    stats = await benchmark.benchmark_batch_publish(
        products=products,
        batch_size=args.batch_size
    )
    
    # 打印报告
    benchmark.print_report(stats)
    
    # 保存结果
    benchmark.save_results(args.output)


if __name__ == "__main__":
    asyncio.run(main())
