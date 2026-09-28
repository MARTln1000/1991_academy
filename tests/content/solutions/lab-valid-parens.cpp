bool isValid(string s) {
    stack<char> st;
    for (char ch : s) {
        if (ch == '(' || ch == '[' || ch == '{') { st.push(ch); continue; }
        char want = ch == ')' ? '(' : ch == ']' ? '[' : '{';
        if (st.empty() || st.top() != want) return false;
        st.pop();
    }
    return st.empty();
}
