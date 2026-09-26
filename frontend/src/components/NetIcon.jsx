import {
    Facebook,
    Instagram,
    Youtube,
    Twitter,
    Music,
    MessageCircle,
    Briefcase,
    MessageSquare,
    AtSign,
    ShoppingBag,
    Activity,
    Settings2,
    Zap,
} from "lucide-react";

const map = {
    facebook: Facebook,
    instagram: Instagram,
    youtube: Youtube,
    twitter: Twitter,
    music: Music,
    "message-circle": MessageCircle,
    briefcase: Briefcase,
    "message-square": MessageSquare,
    "at-sign": AtSign,
    "shopping-bag": ShoppingBag,
    activity: Activity,
    settings: Settings2,
    zap: Zap,
};

export default function NetIcon({ name, className = "", size = 16 }) {
    const Cmp = map[name] || Activity;
    return <Cmp size={size} className={className} strokeWidth={1.8} />;
}
