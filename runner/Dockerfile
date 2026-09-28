# The C++ runner: compiles and runs learners' C++ for the app, in a container
# of its own that holds nothing and can reach nothing. docker-compose.yml
# (service `runner`) adds the rest of the lockdown: no network, read-only,
# resource limits and only the capabilities needed to switch to the per-run
# users. cpp_runner.py explains the design.
FROM python:3.12-slim

RUN apt-get update \
 && apt-get install -y --no-install-recommends g++ \
 && rm -rf /var/lib/apt/lists/*

ENV PYTHONUNBUFFERED=1 \
    PYTHONDONTWRITEBYTECODE=1

WORKDIR /runner
COPY --chmod=644 cpp_runner.py .

# Starts as root only to hand each program to a throwaway user (uid 20000+);
# no learner code ever runs as root.
HEALTHCHECK --interval=30s --timeout=6s --start-period=10s --start-interval=1s --retries=3 \
  CMD ["python", "cpp_runner.py", "ping"]
CMD ["python", "cpp_runner.py"]
