"""
OpenDroid Sandbox — Virtual Screen State definitions for 10 simulated networks.
Each network exposes a distinct algorithmic personality (August 2026 trends).
Telegram Business has been replaced by Dropdashin (AI Dropshipping Store).
"""
from __future__ import annotations
import random
from typing import Any


NETWORKS: dict[str, dict[str, Any]] = {
    "facebook": {
        "name": "Facebook",
        "handle": "Meta Communities",
        "color": "#1877F2",
        "icon": "facebook",
        "algo_vars": ["Group_Trust_Score", "Reels_Retention_Rate"],
        "base_cpm": 8.5,
        "base_ctr": 0.012,
        "virality": 1.0,
        "penalty_promo": True,
    },
    "instagram": {
        "name": "Instagram",
        "handle": "IG Reels & DM Funnels",
        "color": "#E4405F",
        "icon": "instagram",
        "algo_vars": ["Hook_Time_MS", "DM_Automation_Triggered"],
        "base_cpm": 12.4,
        "base_ctr": 0.024,
        "virality": 1.6,
    },
    "youtube": {
        "name": "YouTube",
        "handle": "AdSense + Affiliate",
        "color": "#FF0000",
        "icon": "youtube",
        "algo_vars": ["CTR_Thumbnail", "AVD"],
        "base_cpm": 22.8,
        "base_ctr": 0.031,
        "virality": 0.9,
        "adsense_sim": True,
    },
    "twitter": {
        "name": "X / Twitter",
        "handle": "Velocity Feed",
        "color": "#1DA1F2",
        "icon": "twitter",
        "algo_vars": ["Velocity_Score", "Premium_Boost_Multiplier"],
        "base_cpm": 6.2,
        "base_ctr": 0.018,
        "virality": 1.4,
    },
    "tiktok": {
        "name": "TikTok",
        "handle": "For You Page",
        "color": "#00F0FF",
        "icon": "music",
        "algo_vars": ["Sound_Trend_Match", "TikTok_Shop_Conversion_Vector"],
        "base_cpm": 9.7,
        "base_ctr": 0.028,
        "virality": 2.4,
    },
    "whatsapp": {
        "name": "WhatsApp Communities",
        "handle": "Closed Funnels",
        "color": "#25D366",
        "icon": "message-circle",
        "algo_vars": ["Churn_Rate", "Open_Rate"],
        "base_cpm": 3.4,
        "base_ctr": 0.09,
        "virality": 0.4,
        "high_ticket": True,
    },
    "linkedin": {
        "name": "LinkedIn",
        "handle": "Corporate Authority",
        "color": "#0A66C2",
        "icon": "briefcase",
        "algo_vars": ["Corporate_Authority_Index"],
        "base_cpm": 34.0,
        "base_ctr": 0.014,
        "virality": 0.6,
        "penalize_cliche": True,
    },
    "reddit": {
        "name": "Reddit",
        "handle": "Subreddit Karma",
        "color": "#FF4500",
        "icon": "message-square",
        "algo_vars": ["Karma_Filter_Threshold", "Subreddit_Moderation_Strictness"],
        "base_cpm": 5.1,
        "base_ctr": 0.019,
        "virality": 1.1,
        "ban_risk": 0.08,
    },
    "threads": {
        "name": "Threads",
        "handle": "IG Bridge Feed",
        "color": "#F5F5F5",
        "icon": "at-sign",
        "algo_vars": ["Instagram_Bridge_Traffic"],
        "base_cpm": 7.9,
        "base_ctr": 0.021,
        "virality": 1.2,
    },
    "dropdashin": {
        "name": "Dropdashin",
        "handle": "AI Dropshipping Store",
        "color": "#00FF66",
        "icon": "shopping-bag",
        "algo_vars": [
            "Product_Saturation_Index",
            "AI_Description_Conversion_Vector",
            "Supplier_Latency_MS",
            "Cart_Abandonment_Rate",
        ],
        "base_cpm": 0.0,   # not an ad platform — revenue comes from sales
        "base_ctr": 0.035,
        "virality": 0.8,
        "ecommerce": True,
    },
}


# Niches: hybrid market motor (fixed default + dynamic switcher)
NICHES: dict[str, dict[str, Any]] = {
    "finance_saas_affiliate": {
        "label": "Finance • SaaS • Affiliate",
        "cpm_mult": 1.85,
        "ctr_mult": 0.75,
        "conversion_rate": 0.028,
        "product_value": 120.0,
        "strict_filters": True,
    },
    "ecommerce_drop": {
        "label": "E-commerce / Dropshipping",
        "cpm_mult": 0.9,
        "ctr_mult": 1.35,
        "conversion_rate": 0.021,
        "product_value": 42.0,
        "strict_filters": False,
    },
    "health_fitness": {
        "label": "Health / Fitness",
        "cpm_mult": 1.25,
        "ctr_mult": 1.1,
        "conversion_rate": 0.024,
        "product_value": 68.0,
        "strict_filters": True,
    },
    "entertainment_viral": {
        "label": "Entertainment / Viral",
        "cpm_mult": 0.55,
        "ctr_mult": 2.1,
        "conversion_rate": 0.006,
        "product_value": 15.0,
        "strict_filters": False,
    },
}


SYNTHETIC_AUTHORS = [
    "grindset.ceo", "yieldfarmer_88", "quant_dad", "reelqueen", "0xshadow",
    "affiliate_witch", "founder_daily", "no_code_ninja", "ai_stack_pro",
    "cashflow_mommy", "protocol_pilled", "saas.jesus", "dropdash_dan",
    "hookmaster", "byte_alchemist", "midnight.trader", "algo_gospel",
]

COMMENT_TEMPLATES = {
    "positive": [
        "wait this actually changed my week",
        "sending this to my team rn 🔥",
        "how do you make this look so easy",
        "the hook at 0:02 is criminal",
        "buying the course. shut up and take my money",
        "underrated take. following.",
        "bro just leaked the playbook",
        "screenshotted. saved. tattooed.",
    ],
    "neutral": [
        "interesting angle tbh",
        "gonna test this in Q1",
        "source?",
        "does this work outside the US?",
        "what's the actual CPM tho",
    ],
    "negative": [
        "another AI slop post 💀",
        "this is just repackaged from 2023",
        "reported for spam",
        "your funnel is broken btw",
        "ratio",
    ],
    "buyer": [
        "just placed the order 🛒",
        "checkout worked flawless",
        "restocking my whole store with this",
        "abandoned cart recovered lol",
    ],
}

CONTENT_HOOKS = [
    "I made ${amt} in 30 days with one Reel. Here's the exact system:",
    "The 3-second hook that broke the TikTok algorithm in Q3 2026:",
    "Nobody talks about {niche} arbitrage on LinkedIn. Thread 🧵",
    "Stop posting like it's 2024. This is what actually converts now:",
    "My AI agent just closed ${amt} in DMs while I slept. Here's the flow:",
    "The Dropdashin product that hit ${amt}/day with zero ad spend:",
    "Why {niche} creators are quietly moving off Instagram:",
    "I let the algorithm audit itself. The results are cursed:",
    "The comment section is the new landing page. Proof inside:",
]


def render_hook(niche_label: str) -> str:
    tmpl = random.choice(CONTENT_HOOKS)
    return tmpl.format(
        amt=f"{random.randint(2, 47) * 1000:,}",
        niche=niche_label.split()[0],
    )
